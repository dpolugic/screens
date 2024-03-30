import { getScreenAsLines, getScreenOverlap, mapPointToViewportSpace } from './functions'
import { Line, Screen, ScreenOverlap, Size } from './types'

const drawLine = (ctx: CanvasRenderingContext2D, line: Line, strokeStyle: string): void => {
  const [startPoint, endPoint] = line

  const screenSize: Size = [ctx.canvas.width, ctx.canvas.height]

  ctx.lineWidth = 2
  ctx.strokeStyle = strokeStyle

  ctx.beginPath()
  ctx.moveTo(...mapPointToViewportSpace(startPoint, screenSize))
  ctx.lineTo(...mapPointToViewportSpace(endPoint, screenSize))
  ctx.stroke()
}

const drawScreen = (ctx: CanvasRenderingContext2D, screen: Screen): void => {
  const { topLeft, topRight, bottomLeft, bottomRight } = screen

  const screenSize: Size = [ctx.canvas.width, ctx.canvas.height]

  ctx.lineWidth = 2
  ctx.strokeStyle = '#faf'

  ctx.beginPath()
  ctx.moveTo(...mapPointToViewportSpace(topLeft, screenSize))
  ctx.lineTo(...mapPointToViewportSpace(topRight, screenSize))
  ctx.lineTo(...mapPointToViewportSpace(bottomRight, screenSize))
  ctx.lineTo(...mapPointToViewportSpace(bottomLeft, screenSize))
  ctx.closePath()

  ctx.stroke()
}

const getLinesFromOverlap = (overlap: ScreenOverlap): Line[] => {
  switch (overlap.type) {
    case 'lines':
      return overlap.lines
    case 'screen':
      return getScreenAsLines(overlap.screen)
    case 'partial':
      throw new Error('not implemented')
  }
}

const drawScreenOverlap = (
  ctx: CanvasRenderingContext2D,
  overlap: ScreenOverlap,
  strokeStyle: string
): void => {
  const lines = getLinesFromOverlap(overlap)
  for (const line of lines) {
    drawLine(ctx, line, strokeStyle)
  }
}

export const drawFrame = (
  ctx: CanvasRenderingContext2D,
  screens: Screen[],
  draftScreen: Screen | undefined
): void => {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)

  for (const screen of screens) {
    drawScreen(ctx, screen)
  }

  if (draftScreen) {
    drawScreen(ctx, draftScreen)
  }

  const screensWithDraft = draftScreen !== undefined ? screens.concat(draftScreen) : screens
  const generatedScreens: Screen[] = []

  for (let k = 0; k < 3; k++) {
    const color = ['#f00a', '#0f0a', '#00fa', '#fafa'][k]
    const allScreens = [...screensWithDraft, ...generatedScreens]
    for (let i = 0; i < allScreens.length; i++) {
      const screen1 = allScreens[i]
      for (let j = i + 1; j < allScreens.length; j++) {
        const screen2 = allScreens[j]

        // todo: wrong!
        const overlap = getScreenOverlap(screen1, screen2)

        if (overlap.type === 'screen') {
          const asdf = JSON.stringify(overlap.screen)

          // make sure screen isn't already in list
          if (!generatedScreens.some(x => JSON.stringify(x) === asdf)) {
            generatedScreens.push(overlap.screen)
          }
        }

        drawScreenOverlap(ctx, overlap, color)
      }
    }
  }
}
