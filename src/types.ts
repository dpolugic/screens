export type Point = [x: number, y: number]

export type Size = [width: number, height: number]

export type Pattern = {
  anchor: Point // relative point representing base of new screen.
  target: Point // relative point representing other corner of new screen. can have negative coordinates.
}

// reprents a pattern in relative coordinates.
export type RelativePattern = Pattern & { readonly __brand: unique symbol }

// represents a pattern in absolute coordinates.
export type AbsolutePattern = Pattern & { readonly __brand: unique symbol }

export const asAbsolutePattern = (pattern: Pattern): AbsolutePattern => pattern as AbsolutePattern

export type Boundaries = {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
}
