import {
  combinePatterns,
  getBoundariesFromPattern,
  getScreenSize,
  mapPointToViewportSpace,
  pointIsInBoundaries,
} from './functions'
import { AbsolutePattern, Pattern, Point, Size } from './types'

const mapPatternToViewportSpace = (pattern: Pattern, screenSize: Size): Pattern => ({
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

const isPatternOutOfBounds = (pattern: Pattern): boolean => {
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

// hacky global state
let drawCalls = 0

const drawScreen = (
  ctx: CanvasRenderingContext2D,
  absolutePattern: AbsolutePattern,
  strokeStyle: string
): void => {
  drawCalls += 1

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

// ...
const COLORS = '0123456789abcdef'
  .split('')
  .reverse()
  .map(a => `#fa${a}`)

const MIN_DEPTH = 3
const MAX_DEPTH = Infinity // we'll rely on limiting draw calls instead
const MAX_DRAW_CALLS = 1e4

const shouldCancel = (depth: number): boolean => {
  // Always render to MIN_DEPTH even if the draw call budget is empty
  if (depth < MIN_DEPTH) return false
  if (depth > MAX_DEPTH) return true

  return drawCalls > MAX_DRAW_CALLS
}

// Move each generator forward one step and then yield.
function* runInParallel(generators: Generator<void, void, void>[], isDone: () => boolean) {
  while (!isDone()) {
    let allDone: boolean | undefined = true
    for (const g of generators) {
      const res = g.next()
      allDone &&= res.done
    }
    if (allDone) break

    yield
  }
}

// Run generator until exhausted, as if it was a regular function.
function runUntilDone(generator: Generator<void, void, void>): void {
  let res
  do {
    res = generator.next()
  } while (!res.done)
}

function* drawPattern(
  ctx: CanvasRenderingContext2D,
  absolutePattern: AbsolutePattern,
  patterns: Pattern[],
  depth: number = 0
): Generator<void, void, void> {
  if (shouldCancel(depth)) return
  if (isPatternOutOfBounds(absolutePattern)) return

  const boundaries = getBoundariesFromPattern(absolutePattern)
  if (boundaries.xMax - boundaries.xMin < 0.001) return
  if (boundaries.yMax - boundaries.yMin < 0.001) return

  drawScreen(ctx, absolutePattern, COLORS[Math.min(COLORS.length - 1, depth)])
  yield

  const generators = []
  for (const pattern of patterns) {
    const virtualScreen = combinePatterns(absolutePattern, pattern)
    generators.push(drawPattern(ctx, virtualScreen, patterns, depth + 1))
  }

  yield* runInParallel(generators, () => drawCalls > MAX_DRAW_CALLS)
}

export const drawFrame = (
  ctx: CanvasRenderingContext2D,
  screens: AbsolutePattern[],
  patterns: Pattern[]
): void => {
  drawCalls = 0
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)

  const generators = []
  for (const screen of screens) {
    generators.push(drawPattern(ctx, screen, patterns))
  }

  runUntilDone(runInParallel(generators, () => drawCalls > MAX_DRAW_CALLS))
}
