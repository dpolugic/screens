import { Boundaries, Line, Point, Screen, ScreenOverlap, Size } from './types'

export const getScreenFromTwoPoints = ([x1, y1]: Point, [x2, y2]: Point): Screen => {
  const xMin = Math.min(x1, x2)
  const xMax = Math.max(x1, x2)
  const yMin = Math.min(y1, y2)
  const yMax = Math.max(y1, y2)

  return {
    topLeft: [xMin, yMin],
    topRight: [xMax, yMin],
    bottomLeft: [xMin, yMax],
    bottomRight: [xMax, yMax],
  }
}

export const getScreenBoundaries = (screen: Screen): Boundaries => {
  const { topLeft, bottomRight } = screen
  const [xMin, yMin] = topLeft
  const [xMax, yMax] = bottomRight

  return { xMin, xMax, yMin, yMax }
}

export const pointIsInsideScreen = (point: Point, screen: Screen): boolean => {
  const { xMin, xMax, yMin, yMax } = getScreenBoundaries(screen)
  const [pointX, pointY] = point

  return xMin <= pointX && pointX <= xMax && yMin <= pointY && pointY <= yMax
}

export const getScreenAsLines = (screen: Screen): [Line, Line, Line, Line] => {
  const { topLeft, topRight, bottomLeft, bottomRight } = screen
  return [
    [topLeft, topRight],
    [topRight, bottomRight],
    [bottomRight, bottomLeft],
    [bottomLeft, topLeft],
  ]
}

export const lineIsInsideScreen = (line: Line, screen: Screen): boolean => {
  // Note: This only checks if the entire line is in the screen
  return pointIsInsideScreen(line[0], screen) && pointIsInsideScreen(line[1], screen)
}

export const mapPointToViewportSpace = ([x, y]: Point, [viewportWidth, viewportHeight]: Size): Point => {
  return [x * viewportWidth, y * viewportHeight]
}

export const mapPointFromViewportSpace = ([x, y]: Point, [viewportWidth, viewportHeight]: Size): Point => {
  return [x / viewportWidth, y / viewportHeight]
}

export const getScreenOverlap = (screen: Screen, overlapping: Screen): ScreenOverlap => {
  const isScreenInScreen =
    pointIsInsideScreen(overlapping.topLeft, screen) &&
    pointIsInsideScreen(overlapping.topRight, screen) &&
    pointIsInsideScreen(overlapping.bottomRight, screen) &&
    pointIsInsideScreen(overlapping.bottomLeft, screen)

  if (isScreenInScreen) {
    return {
      type: 'screen',
      screen: {
        topLeft: mapPointBetweenScreens(overlapping.topLeft, screen, overlapping),
        topRight: mapPointBetweenScreens(overlapping.topRight, screen, overlapping),
        bottomRight: mapPointBetweenScreens(overlapping.bottomRight, screen, overlapping),
        bottomLeft: mapPointBetweenScreens(overlapping.bottomLeft, screen, overlapping),
      },
    }
  } else {
    return {
      type: 'lines',
      lines: getScreenAsLines(overlapping).filter(it => lineIsInsideScreen(it, screen)),
    }
  }
}

export const getRelativePointPosition = (point: Point, screen: Screen): Point => {
  const { xMin, xMax, yMin, yMax } = getScreenBoundaries(screen)
  const [x, y] = point

  const relativeX = (x - xMin) / (xMax - xMin)
  const relativeY = (y - yMin) / (yMax - yMin)

  return [relativeX, relativeY]
}

export const resolveRelativePointPosition = (relativePoint: Point, screen: Screen): Point => {
  const { xMin, xMax, yMin, yMax } = getScreenBoundaries(screen)
  const [x, y] = relativePoint

  const resolvedX = xMin + x * (xMax - xMin)
  const resolvedY = yMin + y * (yMax - yMin)

  return [resolvedX, resolvedY]
}

export const mapPointBetweenScreens = (point: Point, fromScreen: Screen, toScreen: Screen): Point => {
  const relativePoint = getRelativePointPosition(point, fromScreen)

  return resolveRelativePointPosition(relativePoint, toScreen)
}

export const getMousePoint = (
  ctx: CanvasRenderingContext2D,
  mouseEvent: React.MouseEvent<HTMLCanvasElement, MouseEvent>
) => {
  const screenSize: Size = [ctx.canvas.width, ctx.canvas.height]
  return mapPointFromViewportSpace([mouseEvent.clientX, mouseEvent.clientY], screenSize)
}
