import { applyPatternToScreen, mapPointToViewportSpace } from './functions'
import { Pattern, Screen, Size } from './types'

const drawScreen = (ctx: CanvasRenderingContext2D, screen: Screen, strokeStyle: string): void => {
  const { topLeft, topRight, bottomLeft, bottomRight } = screen

  const screenSize: Size = [ctx.canvas.width, ctx.canvas.height]

  ctx.lineWidth = 1
  ctx.strokeStyle = strokeStyle

  ctx.beginPath()
  ctx.moveTo(...mapPointToViewportSpace(topLeft, screenSize))
  ctx.lineTo(...mapPointToViewportSpace(topRight, screenSize))
  ctx.lineTo(...mapPointToViewportSpace(bottomRight, screenSize))
  ctx.lineTo(...mapPointToViewportSpace(bottomLeft, screenSize))
  ctx.closePath()

  ctx.stroke()
}

// ...
const COLORS = '0123456789abcdef'
  .split('')
  .reverse()
  .map(a => `#faf${a}`)
const MAX_DEPTH = 10

const drawPattern = (
  ctx: CanvasRenderingContext2D,
  screen: Screen,
  pattern: Pattern,
  depth: number = 0
): void => {
  if (depth > MAX_DEPTH) return

  const virtualScreen = applyPatternToScreen(screen, pattern)

  drawScreen(ctx, virtualScreen, COLORS[depth])

  for (const subpattern of pattern.subpatterns) {
    drawPattern(ctx, virtualScreen, subpattern, depth + 1)
  }
}

export const drawFrame = (
  ctx: CanvasRenderingContext2D,
  screens: Screen[],
  draftScreen: Screen | undefined,
  patterns: Pattern[]
): void => {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)

  for (const screen of screens) {
    drawScreen(ctx, screen, '#fff')
  }

  if (draftScreen) {
    drawScreen(ctx, draftScreen, '#aaa')
  }

  const screensWithDraft = draftScreen !== undefined ? screens.concat(draftScreen) : screens

  // Draw virtual screens
  for (const screen of screensWithDraft) {
    for (const pattern of patterns) {
      drawPattern(ctx, screen, pattern)
    }
  }
}
