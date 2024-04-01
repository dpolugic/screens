import { Boundaries, Pattern, Point, Screen, Size } from './types'

export const getBoundariesFromTwoPoints = ([x1, y1]: Point, [x2, y2]: Point): Boundaries => {
  const xMin = Math.min(x1, x2)
  const xMax = Math.max(x1, x2)
  const yMin = Math.min(y1, y2)
  const yMax = Math.max(y1, y2)

  return {
    xMin,
    xMax,
    yMin,
    yMax,
  }
}

export const getScreenFromTwoPoints = (p1: Point, p2: Point): Screen => {
  const { xMin, xMax, yMin, yMax } = getBoundariesFromTwoPoints(p1, p2)

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

export const pointIsInBoundaries = (point: Point, boundaries: Boundaries): boolean => {
  const { xMin, xMax, yMin, yMax } = boundaries
  const [pointX, pointY] = point

  return xMin <= pointX && pointX <= xMax && yMin <= pointY && pointY <= yMax
}

export const pointIsInsideScreen = (point: Point, screen: Screen): boolean => {
  return pointIsInBoundaries(point, getScreenBoundaries(screen))
}

export const mapPointToViewportSpace = ([x, y]: Point, [viewportWidth, viewportHeight]: Size): Point => {
  return [x * viewportWidth, y * viewportHeight]
}

export const mapPointFromViewportSpace = ([x, y]: Point, [viewportWidth, viewportHeight]: Size): Point => {
  return [x / viewportWidth, y / viewportHeight]
}

export const getRelativePointPosition = (point: Point, boundaries: Boundaries): Point => {
  const { xMin, xMax, yMin, yMax } = boundaries
  const [x, y] = point

  const relativeX = (x - xMin) / (xMax - xMin)
  const relativeY = (y - yMin) / (yMax - yMin)

  return [relativeX, relativeY]
}

export const resolveRelativePointPosition = (relativePoint: Point, boundaries: Boundaries): Point => {
  const { xMin, xMax, yMin, yMax } = boundaries
  const [x, y] = relativePoint

  const resolvedX = xMin + x * (xMax - xMin)
  const resolvedY = yMin + y * (yMax - yMin)

  return [resolvedX, resolvedY]
}

export const mapPointBetweenScreens = (point: Point, fromScreen: Screen, toScreen: Screen): Point => {
  const relativePoint = getRelativePointPosition(point, getScreenBoundaries(fromScreen))

  return resolveRelativePointPosition(relativePoint, getScreenBoundaries(toScreen))
}

const mapRelativeScreenToOtherScreen = (relativeScreen: Screen, targetScreen: Screen): Screen => {
  const targetBoundaries = getScreenBoundaries(targetScreen)

  return {
    topLeft: resolveRelativePointPosition(relativeScreen.topLeft, targetBoundaries),
    topRight: resolveRelativePointPosition(relativeScreen.topRight, targetBoundaries),
    bottomRight: resolveRelativePointPosition(relativeScreen.bottomRight, targetBoundaries),
    bottomLeft: resolveRelativePointPosition(relativeScreen.bottomLeft, targetBoundaries),
  }
}

export const getMousePoint = (
  ctx: CanvasRenderingContext2D,
  mouseEvent: React.MouseEvent<HTMLCanvasElement, MouseEvent>
) => {
  const screenSize: Size = [ctx.canvas.width, ctx.canvas.height]
  return mapPointFromViewportSpace([mouseEvent.clientX, mouseEvent.clientY], screenSize)
}

export const applyPatternToScreen = (screen: Screen, pattern: Pattern): Screen => {
  const relativePatternScreen = getScreenFromTwoPoints(pattern.anchor, pattern.target)

  return mapRelativeScreenToOtherScreen(relativePatternScreen, screen)
}

const convertScreenToPattern = (screen: Screen): Pattern => {
  const { xMin, xMax, yMin, yMax } = getScreenBoundaries(screen)

  // arbitrary. todo: store direction for screens like we do for patterns.
  return {
    anchor: [xMin, yMin],
    target: [xMax, yMax],
  }
}

const combinePatterns = (parent: Pattern, child: Pattern): Pattern => {
  const parentBoundaries = getBoundariesFromTwoPoints(parent.anchor, parent.target)

  return {
    anchor: resolveRelativePointPosition(child.anchor, parentBoundaries),
    target: resolveRelativePointPosition(child.target, parentBoundaries),
  }
}

type NestedPath = number[]

export type ClickedPath = {
  screenIndex: number
  nestedPath: NestedPath
}

const MAX_DEPTH = 4

const findClickedPattern = (
  previousBasePattern: Pattern,
  patterns: Pattern[],
  point: Point, // point is relative to previous base pattern
  path: number[] = []
): NestedPath | undefined => {
  if (path.length > MAX_DEPTH) return undefined

  let best: NestedPath | undefined = undefined

  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i]
    const newBasePattern = combinePatterns(previousBasePattern, pattern)
    const newBoundaries = getBoundariesFromTwoPoints(newBasePattern.anchor, newBasePattern.target)
    const newPath = path.concat(i)

    const nestedResult = findClickedPattern(newBasePattern, patterns, point, newPath)

    if (nestedResult !== undefined) {
      if (best === undefined || nestedResult.length > best.length) {
        best = nestedResult
      }
    } else if (pointIsInBoundaries(point, newBoundaries)) {
      // only check current depth if there's no nested result
      if (best === undefined || path.length > best.length) {
        best = newPath
      }
    }
  }

  return best
}

// const ROOT_PATTERN: Pattern = {
//   anchor: [0, 0],
//   target: [1, 1],
// }

export const findClickedScreenOrPattern = (
  screens: Screen[],
  patterns: Pattern[],
  point: Point
): ClickedPath | undefined => {
  // we'll search a few levels only
  // we're interested in the deepest level that contains the point, since that is rendered on top.

  let best: ClickedPath | undefined = undefined
  for (let i = 0; i < screens.length; i++) {
    const clickedPath = findClickedPattern(convertScreenToPattern(screens[i]), patterns, point)

    if (clickedPath !== undefined) {
      if (best === undefined || clickedPath.length > best.nestedPath.length) {
        best = {
          screenIndex: i,
          nestedPath: clickedPath,
        }
      }
    } else if (pointIsInBoundaries(point, getScreenBoundaries(screens[i]))) {
      // only check current depth if there's no nested result
      if (best === undefined) {
        best = {
          screenIndex: i,
          nestedPath: [],
        }
      }
    }
  }

  return best
}
