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

// ---

const drawScreen = (
  ctx: CanvasRenderingContext2D,
  screenSize: Size,
  absolutePattern: AbsolutePattern,
  strokeStyle: string
): void => {
  const viewportPattern = mapPatternToViewportSpace(absolutePattern, screenSize)
  const [p1, p2, p3, p4] = getPatternPoints(viewportPattern)

  ctx.strokeStyle = strokeStyle

  ctx.beginPath()
  ctx.moveTo(...p1)
  ctx.lineTo(...p2)
  ctx.lineTo(...p3)
  ctx.lineTo(...p4)
  ctx.closePath()

  ctx.fill()
  ctx.stroke()
}

type QueueEntry = {
  currentPattern: AbsolutePattern
  depth: number
}

function* generateDrawQueue(state: State): Generator<QueueEntry, void, void> {
  console.log(
    `generateDrawQueue start. Initial screens: ${state.screens.length}, Patterns: ${state.patterns.length}`
  )

  const patternQueue = new Queue<QueueEntry>(
    state.screens.map(screen => ({
      currentPattern: screen,
      depth: 0,
    }))
  )

  let iterations = 0
  while (patternQueue.size > 0) {
    iterations += 1

    const entry = patternQueue.shift()

    yield entry

    // Don't add patterns that are too deep.
    if (entry.depth >= MAX_DEPTH) {
      console.log(`MAX_DEPTH (${MAX_DEPTH}) reached at depth ${entry.depth}. Breaking from generateDrawQueue loop.`)
      break
    }

    for (const pattern of state.patterns) {
      const virtualScreen = combinePatterns(entry.currentPattern, pattern)

      if (isValidPattern(virtualScreen)) {
        patternQueue.push({
          currentPattern: virtualScreen,
          depth: entry.depth + 1,
        })
      }
    }

    // Give up if queue becomes too large.
    if (patternQueue.size > MAX_QUEUE_SIZE) {
      console.warn('Maximum queue size reached. Rendering cancelled.')
      return
    }
  }

  console.log(`generateDrawQueue done. Total iterations: ${iterations}. Final queue size: ${patternQueue.size}`)
}

export function* drawFrameIncrementally(
  ctx: CanvasRenderingContext2D,
  state: State
): Generator<void, void, void> {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  ctx.fillStyle = 'black'
  ctx.lineWidth = 1
  
  const screenSize = getScreenSize(ctx)

  const drawQueueIterator = generateDrawQueue(state)

  while (true) {
    let drawScreenCalls = 0

    const duration = measure(() => {
      // Manual iteration
      while (true) {
        const iteratorResult = drawQueueIterator.next()

        if (iteratorResult.done) break

        const { currentPattern, depth } = iteratorResult.value

        drawScreenCalls += 1

        drawScreen(ctx, screenSize, currentPattern, COLORS[Math.min(COLORS.length - 1, depth)]!)

        if (depth > MIN_DEPTH && drawScreenCalls >= MAX_DRAW_CALLS) break
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
