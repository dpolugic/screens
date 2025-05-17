import {
  AbsoluteNumber,
  AbsolutePattern,
  AbsolutePoint,
  Boundaries,
  NumberPair,
  Pattern,
  PatternNumber,
  Point,
  RelativeNumber,
  RelativePattern,
  RelativePoint,
  Size,
  State,
  ViewportPoint
} from './types'

function min<N extends PatternNumber>(a: N, b: N): N {
  return a < b ? a : b
}

function max<N extends PatternNumber>(a: N, b: N): N {
  return a > b ? a : b
}

const getBoundariesFromTwoPoints = <N extends PatternNumber>([x1, y1]: Point<N>, [x2, y2]: Point<N>): Boundaries<N> => {
  return {
    xMin: min(x1, x2),
    xMax: max(x1, x2),
    yMin: min(y1, y2),
    yMax: max(y1, y2),
  }
}

export const normalizePattern = <N extends PatternNumber>(pattern: Pattern<N>): Pattern<N> => {
  const { xMin, xMax, yMin, yMax } = getBoundariesFromPattern(pattern)

  return {
    anchor: [xMin, yMin],
    target: [xMax, yMax],
  }
}

export const getBoundariesFromPattern = <N extends PatternNumber>(pattern: Pattern<N>): Boundaries<N>=> {
  return getBoundariesFromTwoPoints(pattern.anchor, pattern.target)
}

export const pointIsInBoundaries = <N extends PatternNumber>(point: Point<N>, boundaries: Boundaries<N>): boolean => {
  const { xMin, xMax, yMin, yMax } = boundaries
  const [pointX, pointY] = point

  return xMin <= pointX && pointX <= xMax && yMin <= pointY && pointY <= yMax
}

const pointIsInPattern = (point: AbsolutePoint, pattern: AbsolutePattern): boolean => {
  return pointIsInBoundaries(point, getBoundariesFromPattern(pattern))
}

export const mapPointToViewportSpace = (
  [x, y]: AbsolutePoint,
  [viewportWidth, viewportHeight]: Size
): ViewportPoint => {
  return [x * viewportWidth, y * viewportHeight] satisfies NumberPair as ViewportPoint
}

// ts-unused-exports:disable-next-line
export const mapPointFromViewportSpace = (
  [x, y]: ViewportPoint,
  [viewportWidth, viewportHeight]: Size
): AbsolutePoint => {
  return [x / viewportWidth, y / viewportHeight] satisfies NumberPair as AbsolutePoint
}

function getRelativePointPosition(point: RelativePoint, pattern: AbsolutePattern | RelativePattern): RelativePoint {
  const [x1, y1] = pattern.anchor
  const [x2, y2] = pattern.target
  const [x, y] = point

  const relativeX = (x - x1) / (x2 - x1)
  const relativeY = (y - y1) / (y2 - y1)

  return [relativeX, relativeY] satisfies NumberPair as RelativePoint
}

export function getRelativePatternPosition(pattern: RelativePattern, basePattern: AbsolutePattern | RelativePattern): RelativePattern {
  return {
    anchor: getRelativePointPosition(pattern.anchor, basePattern),
    target: getRelativePointPosition(pattern.target, basePattern),
  }
}

const resolveRelativePointPosition = <N extends RelativeNumber | AbsoluteNumber>(relativePoint: RelativePoint, pattern: Pattern<N>): Point<N> => {
  const [x1, y1] = pattern.anchor
  const [x2, y2] = pattern.target
  const [x, y] = relativePoint

  const resolvedX = x1 + x * (x2 - x1)
  const resolvedY = y1 + y * (y2 - y1)

  return [resolvedX, resolvedY] satisfies NumberPair as Point<N>
}

export const getScreenSize = (ctx: CanvasRenderingContext2D): Size => [ctx.canvas.width, ctx.canvas.height]

export const getMousePoint = (
  ctx: CanvasRenderingContext2D,
  mouseEvent: React.MouseEvent<HTMLCanvasElement, MouseEvent>
): AbsolutePoint => {
  const mousePosition = [mouseEvent.clientX, mouseEvent.clientY] satisfies NumberPair as ViewportPoint

  return mapPointFromViewportSpace(mousePosition, getScreenSize(ctx))
}

export function combinePatterns<ParentNumber extends RelativeNumber | AbsoluteNumber>(parent: Pattern<ParentNumber>, child: RelativePattern): Pattern<ParentNumber> {
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
  patterns: RelativePattern[],
  point: AbsolutePoint,
  path: number[] = []
): NestedPath | undefined => {
  if (path.length > MAX_DEPTH) return undefined

  let best: NestedPath | undefined = undefined

  for (let i = 0; i < patterns.length; i++) {
    const newBasePattern = combinePatterns(previousBasePattern, patterns[i])
    const newPath = path.concat(i)

    const nestedResult = findClickedPattern(newBasePattern, patterns, point, newPath)

    if (nestedResult !== undefined) {
      if (best === undefined || nestedResult.length > best.length) {
        best = nestedResult
      }
    } else if (best === undefined && pointIsInPattern(point, newBasePattern)) {
      // only check current depth if there's no nested result
      best = newPath
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
    } else if (pointIsInPattern(point, screens[i])) {
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
