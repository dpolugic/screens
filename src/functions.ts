import {
  AbsolutePattern,
  AbsolutePoint,
  Boundaries,
  Pattern,
  Point,
  Size,
  State,
  asAbsolutePoint,
} from './types'

const getBoundariesFromTwoPoints = ([x1, y1]: Point, [x2, y2]: Point): Boundaries => {
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

export const getBoundariesFromPattern = (pattern: Pattern): Boundaries => {
  return getBoundariesFromTwoPoints(pattern.anchor, pattern.target)
}

export const pointIsInBoundaries = (point: Point, boundaries: Boundaries): boolean => {
  const { xMin, xMax, yMin, yMax } = boundaries
  const [pointX, pointY] = point

  return xMin <= pointX && pointX <= xMax && yMin <= pointY && pointY <= yMax
}

export const mapPointToViewportSpace = (
  [x, y]: AbsolutePoint,
  [viewportWidth, viewportHeight]: Size
): Point => {
  return [x * viewportWidth, y * viewportHeight]
}

// ts-unused-exports:disable-next-line
export const mapPointFromViewportSpace = (
  [x, y]: Point,
  [viewportWidth, viewportHeight]: Size
): AbsolutePoint => {
  return asAbsolutePoint([x / viewportWidth, y / viewportHeight])
}

const getRelativePointPosition = (point: Point, pattern: Pattern): Point => {
  const [x1, y1] = pattern.anchor
  const [x2, y2] = pattern.target
  const [x, y] = point

  const relativeX = (x - x1) / (x2 - x1)
  const relativeY = (y - y1) / (y2 - y1)

  return [relativeX, relativeY]
}

export const getRelativePatternPosition = (pattern: Pattern, basePattern: Pattern): Pattern => {
  return {
    anchor: getRelativePointPosition(pattern.anchor, basePattern),
    target: getRelativePointPosition(pattern.target, basePattern),
  }
}

const resolveRelativePointPosition = (relativePoint: Point, pattern: Pattern): Point => {
  const [x1, y1] = pattern.anchor
  const [x2, y2] = pattern.target
  const [x, y] = relativePoint

  const resolvedX = x1 + x * (x2 - x1)
  const resolvedY = y1 + y * (y2 - y1)

  return [resolvedX, resolvedY]
}

export const getScreenSize = (ctx: CanvasRenderingContext2D): Size => [ctx.canvas.width, ctx.canvas.height]

export const getMousePoint = (
  ctx: CanvasRenderingContext2D,
  mouseEvent: React.MouseEvent<HTMLCanvasElement, MouseEvent>
): AbsolutePoint => {
  return mapPointFromViewportSpace([mouseEvent.clientX, mouseEvent.clientY], getScreenSize(ctx))
}

export function combinePatterns(parent: AbsolutePattern, child: Pattern): AbsolutePattern
export function combinePatterns(parent: Pattern, child: Pattern): Pattern
export function combinePatterns(parent: Pattern, child: Pattern): Pattern {
  return {
    anchor: resolveRelativePointPosition(child.anchor, parent),
    target: resolveRelativePointPosition(child.target, parent),
  }
}

type NestedPath = number[]

export type ClickedPath = {
  screenIndex: number
  nestedPath: NestedPath
}

const MAX_DEPTH = 4

const findClickedPattern = (
  previousBasePattern: AbsolutePattern,
  patterns: Pattern[],
  point: AbsolutePoint,
  path: number[] = []
): NestedPath | undefined => {
  if (path.length > MAX_DEPTH) return undefined

  let best: NestedPath | undefined = undefined

  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i]
    const newBasePattern = combinePatterns(previousBasePattern, pattern)
    const newBoundaries = getBoundariesFromPattern(newBasePattern)
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
  { screens, patterns }: State,
  point: AbsolutePoint
): ClickedPath | undefined => {
  // we'll search a few levels only
  // we're interested in the deepest level that contains the point, since that is rendered on top.

  let best: ClickedPath | undefined = undefined
  for (let i = 0; i < screens.length; i++) {
    const clickedPath = findClickedPattern(screens[i], patterns, point)

    if (clickedPath !== undefined) {
      if (best === undefined || clickedPath.length > best.nestedPath.length) {
        best = {
          screenIndex: i,
          nestedPath: clickedPath,
        }
      }
    } else if (pointIsInBoundaries(point, getBoundariesFromPattern(screens[i]))) {
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
