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
    [xMin, yMin],
    [xMax, yMin],
    [xMax, yMax],
    [xMin, yMax],
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

function* runInParallel(generators: Generator<void, void, void>[], isDone: () => boolean) {
  while (!isDone()) {
    let allDone = true
    for (const g of generators) {
      const res = g.next()
      const done = res.done === true
      allDone &&= done
    }
    if (allDone) break

    yield
  }
}

function runUntilDone(generator: Generator<void, void, void>): void {
  let res
  do {
    res = generator.next()
  } while (res.done !== true)
}

function* drawPattern(
  ctx: CanvasRenderingContext2D,
  absolutePattern: AbsolutePattern,
  originalPatterns: Pattern[],
  pattern: Pattern,
  depth: number = 1
): Generator<void, void, void> {
  if (shouldCancel(depth)) return

  const virtualScreen = combinePatterns(absolutePattern, pattern)

  if (isPatternOutOfBounds(virtualScreen)) return

  const boundaries = getBoundariesFromPattern(virtualScreen)
  if (boundaries.xMax - boundaries.xMin < 0.001) return
  if (boundaries.yMax - boundaries.yMin < 0.001) return

  drawScreen(ctx, virtualScreen, COLORS[Math.min(COLORS.length - 1, depth)])
  yield

  const generators = []
  for (const originalPattern of originalPatterns) {
    generators.push(drawPattern(ctx, virtualScreen, originalPatterns, originalPattern, depth + 1))
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

  for (const screen of screens) {
    drawScreen(ctx, screen, COLORS[0])
  }

  // Draw virtual screens
  const generators = []
  for (const screen of screens) {
    for (const pattern of patterns) {
      generators.push(drawPattern(ctx, screen, patterns, pattern))
    }
  }

  runUntilDone(runInParallel(generators, () => drawCalls > MAX_DRAW_CALLS))
}
