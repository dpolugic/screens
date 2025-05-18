import {
  combinePatterns,
  getScreenSize,
  mapPatternToViewportSpace,
  mutateBoundariesFromPattern,
} from './functions'
import { Queue } from './queue'
import { Boundaries, Size, State, ViewportNumber, ViewportPattern } from './types'

// -- constants

const COLOR_SIZE = 50
const COLORS = Array(COLOR_SIZE).fill(undefined).map((_, i) => {
  const frac = i / COLOR_SIZE

  const hue = (80 + 360 * frac) % 360
  const saturation = 50 + (frac * 30)
  const lightness = 60

  return `hsl(${hue} ${saturation}% ${lightness}%)`
})

const MIN_DEPTH = 3
const MAX_DEPTH = Infinity
const MAX_PREVIEW_DRAW_CALLS = 5e3 // number of shapes to draw per preview frame
const MAX_DRAW_TIME_MS = 15 // how long to draw a frame in ms
const MAX_QUEUE_SIZE = 1e6
// const MIN_PATTERN_SIZE = 0.0005 // ignore patterns where either side is smaller than this
const MIN_PATTERN_SIZE_PX = 1 // ignore patterns where either side is smaller than this
const DEBUG = true as boolean

// We'll ignore everything that's a bit outside the viewport.
// This is not really accurate, but should be OK for our purposes.
function getViewportBoundaries(screenSize: Size): Boundaries<ViewportNumber> {
  return {
    xMin: (-0.1 * screenSize[0]) as ViewportNumber,
    xMax: (1.1 * screenSize[0]) as ViewportNumber,
    yMin: (-0.1 * screenSize[1]) as ViewportNumber,
    yMax: (1.1 * screenSize[1]) as ViewportNumber,
  }
}

const measure = (f: () => void): number => {
  const start = performance.now()

  f()

  return performance.now() - start
}

type QueueEntry = {
  currentPattern: ViewportPattern
  depth: number
}

// We'll use a global queue to avoid reallocating it on every preview frame.
const patternQueue = new Queue<QueueEntry>({
  initialItems: [],
  size: MAX_QUEUE_SIZE,
})

const isValidPattern = (() => {
  // Optimization: Only allocate boundaries object once and mutate it in place.
  // Make sure to update this object before using it!
  const patternBoundaries: Boundaries<ViewportNumber> = {
    xMin: 0 as ViewportNumber,
    xMax: 0 as ViewportNumber,
    yMin: 0 as ViewportNumber,
    yMax: 0 as ViewportNumber,
  }

  return function (pattern: ViewportPattern, viewportBoundaries: Boundaries<ViewportNumber>): boolean {
    mutateBoundariesFromPattern(pattern, patternBoundaries)

    return (
      // Pattern fulfills minimum size.
      patternBoundaries.xMax - patternBoundaries.xMin >= MIN_PATTERN_SIZE_PX &&
      patternBoundaries.yMax - patternBoundaries.yMin >= MIN_PATTERN_SIZE_PX &&
      // X and Y ranges overlap with the valid boundaries.
      // We will only render patterns if at least one corner is inside the valid boundaries.
      patternBoundaries.xMin <= viewportBoundaries.xMax &&
      patternBoundaries.xMax >= viewportBoundaries.xMin &&
      patternBoundaries.yMin <= viewportBoundaries.yMax &&
      patternBoundaries.yMax >= viewportBoundaries.yMin
    )
  }
})()

/**
 * Creates a generator that yields drawable patterns one by one.
 *
 * It starts with the initial screens and recursively applies all defined patterns
 * from the state. Each yielded pattern includes its generation depth.
 * The generation proceeds in a breadth-first manner.
 *
 * @param state The current application state, containing screens and patterns.
 * @param screenSize The current size of the screen/viewport.
 * @returns A generator yielding `QueueEntry` objects ({ currentPattern: ViewportPattern, depth: number }).
 */
function* streamDrawablePatterns({
  state,
  screenSize,
}: {
  state: State
  screenSize: Size
}): Generator<QueueEntry, void, void> {
  console.log(
    `generateDrawQueue start. Initial screens: ${state.screens.length}, Patterns: ${state.patterns.length}`
  )

  const viewportBoundaries = getViewportBoundaries(screenSize)

  patternQueue.clear()

  for (const screen of state.screens) {
    patternQueue.push({
      currentPattern: mapPatternToViewportSpace(screen, screenSize),
      depth: 0,
    })
  }

  let iterations = 0
  while (patternQueue.size > 0) {
    iterations += 1

    const entry = patternQueue.shift()

    yield entry

    // Don't add patterns that are too deep.
    if (entry.depth >= MAX_DEPTH) {
      console.log(
        `MAX_DEPTH (${MAX_DEPTH}) reached at depth ${entry.depth}. Breaking from generateDrawQueue loop.`
      )
      break
    }

    for (const pattern of state.patterns) {
      // Get new pattern
      const newViewportPattern = combinePatterns(entry.currentPattern, pattern)

      if (isValidPattern(newViewportPattern, viewportBoundaries)) {
        patternQueue.push({
          currentPattern: newViewportPattern,
          depth: entry.depth + 1,
        })

        // Give up if queue becomes too large.
        if (patternQueue.size >= MAX_QUEUE_SIZE) {
          console.log(
            `Maximum queue size reached. Rendering cancelled. Total iterations: ${iterations}. Final queue size: ${patternQueue.size}`
          )
          return
        }
      }
    }
  }

  console.log(
    `generateDrawQueue done. Total iterations: ${iterations}. Final queue size: ${patternQueue.size}`
  )
}

type Chunk = {
  depth: number
  patterns: ViewportPattern[]
}

/**
 * Creates a generator that groups drawable patterns from `streamDrawablePatterns` into chunks.
 *
 * Patterns are batched together based on their generation depth or a maximum
 * chunk size. This is useful for processing or rendering patterns in groups.
 *
 * @param state The current application state.
 * @param chunkSize The maximum number of patterns to include in a single chunk.
 * @param screenSize The current size of the screen/viewport.
 * @returns A generator yielding `Chunk` objects ({ depth: number, patterns: ViewportPattern[] }).
 */
function* streamBatchedDrawablePatterns({
  state,
  chunkSize,
  screenSize,
}: {
  state: State
  chunkSize: number
  screenSize: Size
}): Generator<Chunk, void, void> {
  const drawQueueIterator = streamDrawablePatterns({ state, screenSize })

  let chunk: Chunk = {
    depth: 0,
    patterns: [],
  }

  for (const entry of drawQueueIterator) {
    if (chunk.depth !== entry.depth) {
      if (chunk.patterns.length > 0) {
        yield chunk
      }

      chunk = {
        depth: entry.depth,
        patterns: [entry.currentPattern],
      }
    } else {
      chunk.patterns.push(entry.currentPattern)

    if (chunk.patterns.length >= chunkSize) {
      yield chunk
      chunk = {
        depth: entry.depth,
        patterns: [],
      }
    }
    }
  }

  if (chunk.patterns.length > 0) {
    yield chunk
  }
}

export function* drawFrameIncrementally(
  ctx: CanvasRenderingContext2D,
  state: State
): Generator<void, void, void> {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  ctx.fillStyle = 'black'
  ctx.lineWidth = 1

  const screenSize = getScreenSize(ctx)

  const batchedPatternsIterator = streamBatchedDrawablePatterns({ state, chunkSize: 1000, screenSize })

  let iterations = 0

  while (true) {
    iterations += 1

    let drawScreenCalls = 0

    const duration = measure(() => {
      const start = performance.now()

      while (true) {
        const iteratorResult = batchedPatternsIterator.next()

        if (iteratorResult.done) break

        const { depth, patterns } = iteratorResult.value

        drawScreenCalls += patterns.length

        // Draw screen
        ctx.strokeStyle = COLORS[Math.min(COLORS.length - 1, depth)]!
        ctx.beginPath()

        // Optimization: Only allocate boundaries object once and mutate it in place.
        const boundaries: Boundaries<ViewportNumber> = {
          xMin: 0 as ViewportNumber,
          xMax: 0 as ViewportNumber,
          yMin: 0 as ViewportNumber,
          yMax: 0 as ViewportNumber,
        }

        for (const viewportPattern of patterns) {
          mutateBoundariesFromPattern(viewportPattern, boundaries)

          // Draw rectangle.
          ctx.rect(
            boundaries.xMin,
            boundaries.yMin,
            boundaries.xMax - boundaries.xMin,
            boundaries.yMax - boundaries.yMin
          )
        }

        ctx.fill()
        ctx.stroke()

        if (iterations === 1) {
          // On the first iteration, draw until passing both MIN_DEPTH and MAX_DRAW_CALLS.
          // We don't want to use a time-based limit here because it could cause flickering.
          if (depth > MIN_DEPTH && drawScreenCalls >= MAX_PREVIEW_DRAW_CALLS) {
            break
          }
        } else {
          // On subsequent iterations, draw until MAX_DRAW_TIME_MS is reached.
          if (performance.now() - start > MAX_DRAW_TIME_MS) {
            break
          }
        }
      }
    })

    if (DEBUG) {
      console.log(`drawFrame done in ${duration.toFixed(0)}ms. Drew ${drawScreenCalls} screens.`)
    }

    if (drawScreenCalls === 0) {
      console.log('No screens to draw. Exiting.')
      break
    }

    yield
  }
}

export function drawFramePreview(ctx: CanvasRenderingContext2D, state: State): void {
  const generator = drawFrameIncrementally(ctx, state)

  generator.next()
  generator.return()
}
