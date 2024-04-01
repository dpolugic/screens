import {
  applyPatternToScreen,
  getScreenBoundaries,
  mapPointToViewportSpace,
  pointIsInBoundaries,
} from './functions'
import { Pattern, Screen, Size } from './types'

const mapScreenToViewportSpace = (screen: Screen, screenSize: Size): Screen => ({
  topLeft: mapPointToViewportSpace(screen.topLeft, screenSize),
  topRight: mapPointToViewportSpace(screen.topRight, screenSize),
  bottomRight: mapPointToViewportSpace(screen.bottomRight, screenSize),
  bottomLeft: mapPointToViewportSpace(screen.bottomLeft, screenSize),
})

const isScreenOutOfBounds = (screen: Screen): boolean => {
  const { topLeft, topRight, bottomLeft, bottomRight } = screen

  // We'll ignore everything more than 1 viewport size away.
  // This is not fully accurate, but should be OK for most purposes.
  return ![topLeft, topRight, bottomLeft, bottomRight].some(p =>
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

const drawScreen = (ctx: CanvasRenderingContext2D, screen: Screen, strokeStyle: string): void => {
  drawCalls += 1

  const screenSize: Size = [ctx.canvas.width, ctx.canvas.height]
  const { topLeft, topRight, bottomLeft, bottomRight } = mapScreenToViewportSpace(screen, screenSize)

  ctx.lineWidth = 1
  ctx.strokeStyle = strokeStyle
  ctx.fillStyle = 'black'

  ctx.beginPath()
  ctx.moveTo(...topLeft)
  ctx.lineTo(...topRight)
  ctx.lineTo(...bottomRight)
  ctx.lineTo(...bottomLeft)
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
  screen: Screen,
  originalPatterns: Pattern[],
  pattern: Pattern,
  depth: number = 1
): Generator<void, void, void> {
  if (shouldCancel(depth)) return
  if (isScreenOutOfBounds(screen)) return

  const virtualScreen = applyPatternToScreen(screen, pattern)

  const boundaries = getScreenBoundaries(virtualScreen)
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

export const drawFrame = (ctx: CanvasRenderingContext2D, screens: Screen[], patterns: Pattern[]): void => {
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
