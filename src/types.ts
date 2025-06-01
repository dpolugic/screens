/** Use this to generate branded types. */
type Brand<T, B extends string> = T & { readonly __brand: B }

// ---
// --- Coordinate types ---
// ---

/** A number that represents a relative coordinate within a pattern. */
// ts-unused-exports:disable-next-line
export type RelativeNumber = Brand<number, 'RelativeNumber'>

/** A number that represents an absolute coordinate in screen space. */
// ts-unused-exports:disable-next-line
export type AbsoluteNumber = Brand<number, 'AbsoluteNumber'>

/** A number that represents an absolute coordinate in viewport space. */
export type ViewportNumber = Brand<number, 'ViewportNumber'>

/** A number that represents a coordinate in a coordinate system. */
export type PatternNumber = RelativeNumber | AbsoluteNumber | ViewportNumber

// ---
// --- Point types ---
// ---

/** A pair of numbers. Typically used as an intermediate type when casting after doing calculations on coordinates. */
export type NumberPair = [x: number, y: number]

/** A coordinate pair. */
export type Point<N extends PatternNumber> = [x: N, y: N]

/** An offset within a pattern. */
export type RelativePoint = Point<RelativeNumber>

/** An absolute point in screen space. */
export type AbsolutePoint = Point<AbsoluteNumber>

/** An absolute point in viewport space. */
export type ViewportPoint = Point<ViewportNumber>

// ---
// --- Pattern types ---
// ---

/** A pattern. Basically a rectangle, but it is defined with two points and can have a direction. */
export type Pattern<N extends PatternNumber> = {
  /** The anchor point of the pattern. If part of a {@link RelativePattern}, this is relative to the parent pattern. */
  anchor: Point<N>
  /** The target point of the pattern. If part of a {@link RelativePattern}, this is relative to the parent pattern. */
  target: Point<N>
}

/** A pattern in relative coordinates. */
export type RelativePattern = Pattern<RelativeNumber>

/** A pattern in absolute coordinates. */
export type AbsolutePattern = Pattern<AbsoluteNumber>

/** A pattern in viewport coordinates. */
export type ViewportPattern = Pattern<ViewportNumber>

// ---
// --- Size and boundaries types ---
// ---

/** A size, typically of the viewport in pixels. */
export type Size = [width: number, height: number]

/** Defines a rectangle in a coordinate system. Unlike {@link Pattern}, this is only the boundary and does not define a direction. */
export type Boundaries<N extends PatternNumber> = {
  xMin: N
  xMax: N
  yMin: N
  yMax: N
}

// ---
// --- State ---
// ---

export type PatternId = Brand<string, 'PatternId'>

export type TransformationMatrix = [a: number, b: number, c: number, d: number]

// ts-unused-exports:disable-next-line
export type TransformationOffset = [x: number, y: number]

export type Transformation = {
  matrix: TransformationMatrix
  offset: TransformationOffset
}

/** This defines what is drawn on the screen. */
export type State = {
  /** These are root-level patterns. */
  screens: AbsolutePattern[]

  /** These are nested patterns. They are applied recursively to root-level patterns. */
  patterns: {
    /** The id of the pattern. Relevant for editing. */
    id: PatternId

    /** A 2x2 matrix that defines how to scale and rotate the pattern. */
    matrix: TransformationMatrix

    /** An offset that is applied to the pattern. */
    offset: TransformationOffset
  }[]
}
