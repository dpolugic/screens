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

// -- hacky global state

type GlobalMutableState = {
  drawScreenCalls: number
  maxQueueSize: number
  queueIterations: number
}

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

const draw = (
  ctx: CanvasRenderingContext2D,
  state: State,
  globalMutableState: GlobalMutableState,
  queue: Queue<QueueEntry>
): void => {
  const screenSize = getScreenSize(ctx)

  // Shared styles.
  ctx.fillStyle = 'black'
  ctx.lineWidth = 1

  while (queue.size > 0) {
    globalMutableState.queueIterations += 1
    const { currentPattern, depth } = queue.shift()!

    if (depth > MAX_DEPTH) break
    // Always render to MIN_DEPTH even if the draw call budget is empty
    if (depth > MIN_DEPTH && globalMutableState.drawScreenCalls >= MAX_DRAW_CALLS) break

    globalMutableState.drawScreenCalls += 1
    drawScreen(ctx, screenSize, currentPattern, COLORS[Math.min(COLORS.length - 1, depth)]!)

    for (const pattern of state.patterns) {
      const virtualScreen = combinePatterns(currentPattern, pattern)

      if (isValidPattern(virtualScreen)) {
        queue.push({
          currentPattern: virtualScreen,
          depth: depth + 1,
        })
      }
    }

    globalMutableState.maxQueueSize = Math.max(globalMutableState.maxQueueSize, queue.size)
  }
}

export function* drawFrameIncrementally(
  ctx: CanvasRenderingContext2D,
  state: State
): Generator<void, void, void> {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)

  const drawQueue = new Queue(
    state.screens.map(screen => ({
      currentPattern: screen,
      depth: 0,
    }))
  )

  while (drawQueue.size > 0) {
    const globalMutableState: GlobalMutableState = {
      drawScreenCalls: 0,
      maxQueueSize: drawQueue.size,
      queueIterations: 0,
    }

    const duration = measure(() => {
      draw(ctx, state, globalMutableState, drawQueue)
      drawQueue.compact()
    })

    if (DEBUG) {
      console.log(
        `drawFrame done in ${duration.toFixed(0)}ms. Queue size: ${drawQueue.size}. ${JSON.stringify(globalMutableState)}.`
      )
    }

    // Give up if queue becomes too large.
    if (drawQueue.size > MAX_QUEUE_SIZE) {
      console.warn('Maximum queue size reached. Rendering cancelled.')
      return
    }

    yield
  }
}

export function drawFramePreview(ctx: CanvasRenderingContext2D, state: State): void {
  const generator = drawFrameIncrementally(ctx, state)

  generator.next()
  generator.return()
}
