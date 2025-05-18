import {
  AbsolutePattern,
  AbsolutePoint,
  Boundaries,
  NumberPair,
  Pattern,
  PatternNumber,
  Point,
  RelativePattern,
  RelativePoint,
  Size,
  State,
  ViewportNumber,
  ViewportPattern,
  ViewportPoint,
} from './types'

/**
 * This function mutates the boundaries object in place.
 *
 * This is a performance optimization to avoid creating new objects, since this function is called very frequently
 * during rendering.
 */
export const mutateBoundariesFromPattern = (() => {
  let x1: PatternNumber
  let y1: PatternNumber
  let x2: PatternNumber
  let y2: PatternNumber

  return function <N extends PatternNumber>(pattern: Pattern<N>, boundaries: Boundaries<N>): void {
    x1 = pattern.anchor[0]
    y1 = pattern.anchor[1]
    x2 = pattern.target[0]
    y2 = pattern.target[1]

    boundaries.xMin = Math.min(x1, x2) as N
    boundaries.xMax = Math.max(x1, x2) as N
    boundaries.yMin = Math.min(y1, y2) as N
    boundaries.yMax = Math.max(y1, y2) as N
  }
})()

const getBoundariesFromPattern = <N extends PatternNumber>(pattern: Pattern<N>): Boundaries<N> => {
  const obj: Boundaries<N> = { xMin: 0 as N, xMax: 0 as N, yMin: 0 as N, yMax: 0 as N }
  mutateBoundariesFromPattern(pattern, obj)
  return obj
}

const pointIsInBoundaries = <N extends PatternNumber>(
  point: Point<N>,
  boundaries: Boundaries<N>
): boolean => {
  const { xMin, xMax, yMin, yMax } = boundaries
  const [pointX, pointY] = point

  return xMin <= pointX && pointX <= xMax && yMin <= pointY && pointY <= yMax
}

const pointIsInPattern = (point: AbsolutePoint, pattern: AbsolutePattern): boolean => {
  return pointIsInBoundaries(point, getBoundariesFromPattern(pattern))
}

const mapPointToViewportSpace = (
  [x, y]: AbsolutePoint,
  [viewportWidth, viewportHeight]: Size
): ViewportPoint => {
  return [x * viewportWidth, y * viewportHeight] satisfies NumberPair as ViewportPoint
}

// ts-unused-exports:disable-next-line
export const mapPatternToViewportSpace = (pattern: AbsolutePattern, screenSize: Size): ViewportPattern => ({
  anchor: mapPointToViewportSpace(pattern.anchor, screenSize),
  target: mapPointToViewportSpace(pattern.target, screenSize),
})

// ts-unused-exports:disable-next-line
export const getPatternPoints = <N extends PatternNumber>(
  pattern: Pattern<N>
): [Point<N>, Point<N>, Point<N>, Point<N>] => {
  const { xMin, xMax, yMin, yMax } = getBoundariesFromPattern(pattern)

  return [
    [xMin, yMin], // top left
    [xMax, yMin], // top right
    [xMax, yMax], // bottom right
    [xMin, yMax], // bottom left
  ]
}

// ts-unused-exports:disable-next-line
export const mapPointFromViewportSpace = (
  [x, y]: ViewportPoint,
  [viewportWidth, viewportHeight]: Size
): AbsolutePoint => {
  return [x / viewportWidth, y / viewportHeight] satisfies NumberPair as AbsolutePoint
}

function getRelativePointPosition(
  point: RelativePoint,
  pattern: AbsolutePattern | RelativePattern
): RelativePoint {
  const [x1, y1] = pattern.anchor
  const [x2, y2] = pattern.target
  const [x, y] = point

  const relativeX = (x - x1) / (x2 - x1)
  const relativeY = (y - y1) / (y2 - y1)

  return [relativeX, relativeY] satisfies NumberPair as RelativePoint
}

export function getRelativePatternPosition(
  pattern: RelativePattern,
  basePattern: AbsolutePattern | RelativePattern
): RelativePattern {
  return {
    anchor: getRelativePointPosition(pattern.anchor, basePattern),
    target: getRelativePointPosition(pattern.target, basePattern),
  }
}

const resolveRelativePointPositionInPlace = (() => {
  let x1: PatternNumber
  let y1: PatternNumber
  let x2: PatternNumber
  let y2: PatternNumber
  let x: PatternNumber
  let y: PatternNumber

  return function <N extends PatternNumber>(
    relativePoint: RelativePoint,
    pattern: Pattern<N>,
    newPoint: Point<N>
  ): void {
    x1 = pattern.anchor[0]
    y1 = pattern.anchor[1]
    x2 = pattern.target[0]
    y2 = pattern.target[1]
    x = relativePoint[0]
    y = relativePoint[1]

    newPoint[0] = (x1 + x * (x2 - x1)) as N
    newPoint[1] = (y1 + y * (y2 - y1)) as N
  }
})()

const resolveRelativePointPosition = <N extends PatternNumber>(
  relativePoint: RelativePoint,
  pattern: Pattern<N>
): Point<N> => {
  const newPoint = [0, 0] satisfies NumberPair as Point<N>

  resolveRelativePointPositionInPlace(relativePoint, pattern, newPoint)

  return newPoint
}

export const getScreenSize = (ctx: CanvasRenderingContext2D): Size => [ctx.canvas.width, ctx.canvas.height]

export const getMousePoint = (
  ctx: CanvasRenderingContext2D,
  mouseEvent: React.MouseEvent<HTMLCanvasElement, MouseEvent>
): AbsolutePoint => {
  const mousePosition = [mouseEvent.clientX, mouseEvent.clientY] satisfies NumberPair as ViewportPoint

  return mapPointFromViewportSpace(mousePosition, getScreenSize(ctx))
}

export function combinePatterns<ParentNumber extends PatternNumber>(
  parent: Pattern<ParentNumber>,
  child: RelativePattern
): Pattern<ParentNumber> {
  return {
    anchor: resolveRelativePointPosition(child.anchor, parent),
    target: resolveRelativePointPosition(child.target, parent),
  }
}

/**
 * Rounds coordinates of the pattern to the nearest integer. NOTE: Mutates the pattern in place.
 *
 * This is a performance optimization to avoid anti-aliasing.
 */
// ts-unused-exports:disable-next-line
export function roundViewportPatternInPlace(pattern: ViewportPattern): ViewportPattern {
  pattern.anchor[0] = Math.round(pattern.anchor[0]) as ViewportNumber
  pattern.anchor[1] = Math.round(pattern.anchor[1]) as ViewportNumber
  pattern.target[0] = Math.round(pattern.target[0]) as ViewportNumber
  pattern.target[1] = Math.round(pattern.target[1]) as ViewportNumber
  return pattern
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
    const newBasePattern = combinePatterns(previousBasePattern, patterns[i]!)
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
    const screen = screens[i]!
    const clickedPath = findClickedPattern(screen, patterns, point)

    if (clickedPath !== undefined) {
      if (best === undefined || clickedPath.length > best.nestedPath.length) {
        best = {
          screenIndex: i,
          nestedPath: clickedPath,
        }
      }
    } else if (pointIsInPattern(point, screen)) {
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
