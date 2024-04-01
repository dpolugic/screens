type Brand<T> = T & { readonly __brand: unique symbol }

export type Point = [x: number, y: number]

export type AbsolutePoint = Brand<Point>

export const asAbsolutePoint = (point: Point): AbsolutePoint => point as AbsolutePoint

export type Size = [width: number, height: number]

export type Pattern<P extends Point = Point> = {
  anchor: P // relative point representing base of new screen.
  target: P // relative point representing other corner of new screen. can have negative coordinates.
}

// represents a pattern in relative coordinates.
export type RelativePattern = Brand<Pattern>

// represents a pattern in absolute coordinates.
export type AbsolutePattern = Pattern<AbsolutePoint>

export const asAbsolutePattern = (pattern: Pattern): AbsolutePattern => pattern as AbsolutePattern

export type Boundaries = {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
}

export type State = {
  screens: AbsolutePattern[]
  patterns: Pattern[]
}
