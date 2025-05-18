import {
  combinePatterns,
  getBoundariesFromPattern,
  getScreenSize,
  mapPointToViewportSpace,
} from './functions'
import { Queue } from './queue'
import {
  AbsoluteNumber,
  AbsolutePattern,
  Boundaries,
  Pattern,
  PatternNumber,
  Point,
  Size,
  State,
  ViewportPattern,
} from './types'

// -- constants

// todo: handle colors in a better way
const COLORS = '0123456789abcdef'
  .split('')
  .reverse()
  .map(a => `#fa${a}`)

const MIN_DEPTH = 3
const MAX_DEPTH = Infinity
const MAX_DRAW_CALLS = 1e4 // number of shapes to draw per frame
const MAX_DRAW_TIME_MS = 15 // how long to draw a frame in ms
const MAX_QUEUE_SIZE = 1e6
const MIN_PATTERN_SIZE = 0.0005 // ignore patterns where either side is smaller than this
const DEBUG = true as boolean

// -- helper functions

const mapPatternToViewportSpace = (pattern: AbsolutePattern, screenSize: Size): ViewportPattern => ({
  anchor: mapPointToViewportSpace(pattern.anchor, screenSize),
  target: mapPointToViewportSpace(pattern.target, screenSize),
})

const getPatternPoints = <N extends PatternNumber>(
  pattern: Pattern<N>
): [Point<N>, Point<N>, Point<N>, Point<N>] => {
  const { xMin, xMax, yMin, yMax } = getBoundariesFromPattern(pattern)

  return [
    [xMin, yMin], // top left
    [xMax, yMin], // top right
    [xMax, yMax], // bottom right
    [xMin, yMax], // bottom left
  ]
}

// We'll ignore everything that's a bit outside the viewport.
// This is not really accurate, but should be OK for our purposes.
const VALID_BOUNDARIES: Boundaries<AbsoluteNumber> = {
  xMin: -0.1 as AbsoluteNumber,
  xMax: 1.1 as AbsoluteNumber,
  yMin: -0.1 as AbsoluteNumber,
  yMax: 1.1 as AbsoluteNumber,
}

const isValidPattern = (pattern: AbsolutePattern): boolean => {
  const { xMin, xMax, yMin, yMax } = getBoundariesFromPattern(pattern)

  return (
    // Pattern fulfills minimum size.
    xMax - xMin >= MIN_PATTERN_SIZE &&
    yMax - yMin >= MIN_PATTERN_SIZE &&
    // X and Y ranges overlap with the valid boundaries.
    // We will only render patterns if at least one corner is inside the valid boundaries.
    xMin <= VALID_BOUNDARIES.xMax &&
    xMax >= VALID_BOUNDARIES.xMin &&
    yMin <= VALID_BOUNDARIES.yMax &&
    yMax >= VALID_BOUNDARIES.yMin
  )
}

const measure = (f: () => void): number => {
  const start = performance.now()

  f()

  return performance.now() - start
}

type QueueEntry = {
  currentPattern: AbsolutePattern
  depth: number
}

// We'll use a global queue to avoid reallocating it on every preview frame.
const patternQueue = new Queue<QueueEntry>({
  initialItems: [],
  size: MAX_QUEUE_SIZE,
})

function* generateDrawQueue(state: State): Generator<QueueEntry, void, void> {
  console.log(
    `generateDrawQueue start. Initial screens: ${state.screens.length}, Patterns: ${state.patterns.length}`
  )

  patternQueue.clear()

  for (const screen of state.screens) {
    patternQueue.push({
      currentPattern: screen,
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
      const virtualScreen = combinePatterns(entry.currentPattern, pattern)

      if (isValidPattern(virtualScreen)) {
        patternQueue.push({
          currentPattern: virtualScreen,
          depth: entry.depth + 1,
        })

        // Give up if queue becomes too large.
        if (patternQueue.size >= MAX_QUEUE_SIZE) {
          console.warn('Maximum queue size reached. Rendering cancelled.')
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
  patterns: AbsolutePattern[]
}

function* generateChunkedDraws(state: State, chunkSize: number): Generator<Chunk, void, void> {
  const drawQueueIterator = generateDrawQueue(state)

  let chunk: Chunk = {
    depth: 0,
    patterns: [],
  }

  while (true) {
    const iteratorResult = drawQueueIterator.next()

    if (iteratorResult.done) {
      if (chunk.patterns.length > 0) {
        yield chunk
      }

      break
    }

    const entry = iteratorResult.value

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
    }

    if (chunk.patterns.length >= chunkSize) {
      yield chunk
      chunk = {
        depth: entry.depth,
        patterns: [],
      }
    }
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

  const chunkedDrawsIterator = generateChunkedDraws(state, 1000)

  let iterations = 0

  while (true) {
    iterations += 1

    let drawScreenCalls = 0

    const duration = measure(() => {
      const start = performance.now()
      
      while (true) {
        const iteratorResult = chunkedDrawsIterator.next()

        if (iteratorResult.done) break

        const { depth, patterns } = iteratorResult.value

        drawScreenCalls += patterns.length

        // Draw screen
        ctx.strokeStyle = COLORS[Math.min(COLORS.length - 1, depth)]!
        ctx.beginPath()
      
        for (const absolutePattern of patterns) {
          const viewportPattern = mapPatternToViewportSpace(absolutePattern, screenSize)
          const [p1, p2, p3, p4] = getPatternPoints(viewportPattern)
      
          ctx.moveTo(...p1)
          ctx.lineTo(...p2)
          ctx.lineTo(...p3)
          ctx.lineTo(...p4)
          ctx.closePath()
        }

        ctx.fill()
        ctx.stroke()

        if (iterations === 1) {
          // On the first iteration, draw until passing both MIN_DEPTH and MAX_DRAW_CALLS.
          // We don't want to use a time-based limit here because it would cause flickering.
          if (depth > MIN_DEPTH && drawScreenCalls >= MAX_DRAW_CALLS) {
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
