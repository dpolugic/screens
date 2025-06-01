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
  Transformation,
  TransformationMatrix,
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

export const getBoundariesFromPattern = <N extends PatternNumber>(pattern: Pattern<N>): Boundaries<N> => {
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
  const canvasRect = ctx.canvas.getBoundingClientRect()
  const mousePosition = [
    mouseEvent.clientX - canvasRect.x,
    mouseEvent.clientY - canvasRect.y,
  ] satisfies NumberPair as ViewportPoint

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
  previousBaseTransformation: Transformation,
  transformations: Transformation[],
  point: AbsolutePoint,
  path: number[] = []
): NestedPath | undefined => {
  if (path.length > MAX_DEPTH) return undefined

  let best: NestedPath | undefined = undefined

  for (let i = 0; i < transformations.length; i++) {
    const newBaseTransformation = combineTransformations(
      previousBaseTransformation.matrix,
      previousBaseTransformation.offset,
      transformations[i]!.matrix,
      transformations[i]!.offset
    )
    const newPath = path.concat(i)

    const nestedResult = findClickedPattern(newBaseTransformation, transformations, point, newPath)

    if (nestedResult !== undefined) {
      if (best === undefined || nestedResult.length > best.length) {
        best = nestedResult
      }
    } else if (
      best === undefined &&
      pointIsInPattern(
        point,
        applyMatrixAndOffsetToRectangle(newBaseTransformation.matrix, newBaseTransformation.offset, {
          anchor: [0, 0],
          target: [1, 1],
        } as AbsolutePattern)
      )
    ) {
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

    const clickedPath = findClickedPattern(getMatrixAndOffsetFromRectangle(screen), patterns, point)

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

export function randomId(): string {
  // todo: use uuid or something
  return Math.random().toString(36).substring(2, 15)
}

export function getMatrixAndOffsetFromRectangle<N extends PatternNumber>(
  rectangle: Pattern<N>
): {
  matrix: [a: number, b: number, c: number, d: number]
  offset: [x: number, y: number]
} {
  const { anchor, target } = rectangle

  const [x1, y1] = anchor
  const [x2, y2] = target

  // The transformation is: newX = x1 + relativeX * (x2 - x1), newY = y1 + relativeY * (y2 - y1)
  // This can be written as a matrix transformation:
  // [newX] = [(x2-x1)    0    ] [relativeX] + [x1]
  // [newY]   [0       (y2-y1)] [relativeY]   [y1]

  const scaleX = x2 - x1
  const scaleY = y2 - y1
  const offsetX = x1
  const offsetY = y1

  const matrix = [scaleX, 0, 0, scaleY] satisfies [a: number, b: number, c: number, d: number]
  const offset = [offsetX, offsetY] satisfies [x: number, y: number]

  return { matrix, offset }
}

// ts-unused-exports:disable-next-line
export function matmul(a: TransformationMatrix, b: TransformationMatrix): TransformationMatrix {
  const [a1, b1, c1, d1] = a
  const [a2, b2, c2, d2] = b

  return [a1 * a2 + c1 * b2, b1 * a2 + d1 * b2, a1 * c2 + c1 * d2, b1 * c2 + d1 * d2]
}

function vecMatMul(
  [a, b]: [x: number, y: number],
  [a1, b1, c1, d1]: TransformationMatrix
): [x: number, y: number] {
  return [a1 * a + c1 * b, b1 * a + d1 * b]
}

// ts-unused-exports:disable-next-line
export function vecScale(a: [x: number, y: number], s: number): [x: number, y: number] {
  return [a[0] * s, a[1] * s]
}

// ts-unused-exports:disable-next-line
export function vecMul(a: [x: number, y: number], b: [x: number, y: number]): [x: number, y: number] {
  return [a[0] * b[0], a[1] * b[1]]
}

// ts-unused-exports:disable-next-line
function vecAdd(a: [x: number, y: number], b: [x: number, y: number]): [x: number, y: number] {
  return [a[0] + b[0], a[1] + b[1]]
}

// ts-unused-exports:disable-next-line
export function vecSub(a: [x: number, y: number], b: [x: number, y: number]): [x: number, y: number] {
  return [a[0] - b[0], a[1] - b[1]]
}

export function applyMatrixAndOffsetToRectangle<ParentNumber extends PatternNumber>(
  matrix: [a: number, b: number, c: number, d: number],
  offset: [x: number, y: number],
  rectangle: Pattern<ParentNumber>
): Pattern<ParentNumber> {
  const { anchor, target } = rectangle

  // Apply the affine transformation to both corner points
  // For each point: newPoint = matrix * point + offset
  const newAnchor = vecAdd(vecMatMul(anchor, matrix), offset) as Point<ParentNumber>
  const newTarget = vecAdd(vecMatMul(target, matrix), offset) as Point<ParentNumber>

  return {
    anchor: newAnchor,
    target: newTarget,
  }
}

// export function combineTransformations(
//   matrix1: [a: number, b: number, c: number, d: number],
//   offset1: [x: number, y: number],
//   matrix2: [a: number, b: number, c: number, d: number],
//   offset2: [x: number, y: number]
// ): { matrix: [a: number, b: number, c: number, d: number]; offset: [x: number, y: number] } {
//   const [x1, y1] = offset1
//   const [x2, y2] = offset2

//   const matrix = matmul(matrix1, matrix2)
//   const offset = [x1 + x2, y1 + y2] satisfies [x: number, y: number]

//   return {
//     matrix,
//     offset,
//   }
// }

// Represent affine transformation as 3x3 homogeneous matrix
type HomogeneousMatrix = [
  a: number,
  c: number,
  tx: number,
  b: number,
  d: number,
  ty: number,
  // [0, 0, 1] is implicit
]

function toHomogeneous(
  matrix: [a: number, b: number, c: number, d: number],
  offset: [x: number, y: number]
): HomogeneousMatrix {
  const [a, b, c, d] = matrix
  const [tx, ty] = offset
  return [a, c, tx, b, d, ty]
}

function fromHomogeneous(homogeneous: HomogeneousMatrix): {
  matrix: [a: number, b: number, c: number, d: number]
  offset: [x: number, y: number]
} {
  const [a, c, tx, b, d, ty] = homogeneous
  return {
    matrix: [a, b, c, d],
    offset: [tx, ty],
  }
}

function multiplyHomogeneous(h1: HomogeneousMatrix, h2: HomogeneousMatrix): HomogeneousMatrix {
  const [a1, c1, tx1, b1, d1, ty1] = h1
  const [a2, c2, tx2, b2, d2, ty2] = h2

  // Matrix multiplication for 3x3 homogeneous matrices
  return [
    a1 * a2 + c1 * b2, // new a
    a1 * c2 + c1 * d2, // new c
    a1 * tx2 + c1 * ty2 + tx1, // new tx (offset gets transformed!)
    b1 * a2 + d1 * b2, // new b
    b1 * c2 + d1 * d2, // new d
    b1 * tx2 + d1 * ty2 + ty1, // new ty (offset gets transformed!)
  ]
}

export function combineTransformations(
  matrix1: [a: number, b: number, c: number, d: number],
  offset1: [x: number, y: number],
  matrix2: [a: number, b: number, c: number, d: number],
  offset2: [x: number, y: number]
): { matrix: [a: number, b: number, c: number, d: number]; offset: [x: number, y: number] } {
  const h1 = toHomogeneous(matrix1, offset1)
  const h2 = toHomogeneous(matrix2, offset2)
  const combined = multiplyHomogeneous(h1, h2)
  return fromHomogeneous(combined)
}
