import {
  combinePatterns,
  getBoundariesFromPattern,
  getScreenSize,
  mapPointToViewportSpace,
  pointIsInBoundaries,
} from './functions'
import { AbsolutePattern, Pattern, Point, Size, State } from './types'

// -- constants

// todo: handle colors in a better way
const COLORS = '0123456789abcdef'
  .split('')
  .reverse()
  .map(a => `#fa${a}`)

const MIN_DEPTH = 3
// Rather than limiting the max depth, we'll limit the number of draw calls instead.
const MAX_DEPTH = Infinity
const MAX_DRAW_CALLS = 1e4
const SIZE_LIMIT = 0.001
const DEBUG = true as boolean

// -- hacky global state

type GlobalMutableState = {
  drawScreenCalls: number
  drawPatternCalls: number
}

// -- helper functions

const mapPatternToViewportSpace = (pattern: AbsolutePattern, screenSize: Size): Pattern => ({
  anchor: mapPointToViewportSpace(pattern.anchor, screenSize),
  target: mapPointToViewportSpace(pattern.target, screenSize),
})

const getPatternPoints = (pattern: Pattern): Point[] => {
  const { xMin, xMax, yMin, yMax } = getBoundariesFromPattern(pattern)

  return [
    [xMin, yMin], // top left
    [xMax, yMin], // top right
    [xMax, yMax], // bottom right
    [xMin, yMax], // bottom left
  ]
}

const isPatternOutOfBounds = (pattern: AbsolutePattern): boolean => {
  // We'll ignore everything more than 1 viewport size away.
  // This is not fully accurate, but should be OK for most purposes.
  return !getPatternPoints(pattern).some(p =>
    pointIsInBoundaries(p, {
      xMin: -1,
      xMax: 2,
      yMin: -1,
      yMax: 2,
    })
  )
}

const isPatternTooSmall = (pattern: AbsolutePattern): boolean => {
  const boundaries = getBoundariesFromPattern(pattern)
  return boundaries.xMax - boundaries.xMin < SIZE_LIMIT || boundaries.yMax - boundaries.yMin < SIZE_LIMIT
}

const isValidPattern = (pattern: AbsolutePattern): boolean => {
  return !isPatternTooSmall(pattern) && !isPatternOutOfBounds(pattern)
}

const measure = (f: () => void): number => {
  const start = performance.now()

  f()

  return performance.now() - start
}

const shouldCancelEarly = (depth: number, globalMutableState: GlobalMutableState): boolean => {
  if (depth > MAX_DEPTH) return true
  // Always render to MIN_DEPTH even if the draw call budget is empty
  if (depth > MIN_DEPTH && globalMutableState.drawScreenCalls >= MAX_DRAW_CALLS) return true

  return false
}

// ---

const drawScreen = (
  ctx: CanvasRenderingContext2D,
  absolutePattern: AbsolutePattern,
  strokeStyle: string,
  globalMutableState: GlobalMutableState
): void => {
  globalMutableState.drawScreenCalls += 1

  const viewportPattern = mapPatternToViewportSpace(absolutePattern, getScreenSize(ctx))
  const [p1, p2, p3, p4] = getPatternPoints(viewportPattern)

  ctx.lineWidth = 1
  ctx.strokeStyle = strokeStyle
  ctx.fillStyle = 'black'

  ctx.beginPath()
  ctx.moveTo(...p1)
  ctx.lineTo(...p2)
  ctx.lineTo(...p3)
  ctx.lineTo(...p4)
  ctx.closePath()

  ctx.fill()
  ctx.stroke()
}

// Move each generator forward one step and then yield.
function* runInParallel(generators: Generator<void, void, void>[]) {
  let res
  let allDone = true

  for (;;) {
    allDone = true
    for (const g of generators) {
      res = g.next()
      allDone &&= !!res.done
    }
    if (allDone) break
    yield
  }
}

// Run generator until exhausted as if it was a regular function.
function runUntilDone(generator: Generator<void, void, void>): void {
  let res
  do {
    res = generator.next()
  } while (!res.done)
}

function* drawPattern(
  ctx: CanvasRenderingContext2D,
  validatedPattern: AbsolutePattern,
  patterns: Pattern[],
  globalMutableState: GlobalMutableState,
  depth: number = 0
): Generator<void, void, void> {
  globalMutableState.drawPatternCalls += 1

  if (shouldCancelEarly(depth, globalMutableState)) return

  drawScreen(ctx, validatedPattern, COLORS[Math.min(COLORS.length - 1, depth)], globalMutableState)
  yield

  // Don't bother handling the next level if we're just going to cancel early.
  if (shouldCancelEarly(depth + 1, globalMutableState)) return

  const generators = patterns.flatMap(pattern => {
    const virtualScreen = combinePatterns(validatedPattern, pattern)

    return isValidPattern(virtualScreen)
      ? drawPattern(ctx, virtualScreen, patterns, globalMutableState, depth + 1)
      : []
  })

  if (generators.length === 0) return

  yield* runInParallel(generators)
}

export const drawFrame = (ctx: CanvasRenderingContext2D, state: State): void => {
  const globalMutableState: GlobalMutableState = {
    drawScreenCalls: 0,
    drawPatternCalls: 0,
  }

  const duration = measure(() => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)

    const generators = state.screens.flatMap(screen => {
      return isValidPattern(screen) ? [drawPattern(ctx, screen, state.patterns, globalMutableState)] : []
    })

    runUntilDone(runInParallel(generators))
  })

  if (DEBUG) {
    console.log(
      `drawFrame done in ${duration.toFixed(0)}ms. drawScreen calls: ${globalMutableState.drawScreenCalls}. drawPattern calls: ${globalMutableState.drawPatternCalls}`
    )
  }
}
