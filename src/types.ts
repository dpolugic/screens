type Brand<T, B extends string> = T & { readonly __brand: B }

// ts-unused-exports:disable-next-line
export type RelativeNumber = Brand<number, 'RelativeNumber'>
// ts-unused-exports:disable-next-line
export type AbsoluteNumber = Brand<number, 'AbsoluteNumber'>
export type ViewportNumber = Brand<number, 'ViewportNumber'>

export type PatternNumber = RelativeNumber | AbsoluteNumber | ViewportNumber

// Used as intermediate type when casting after doing calculations on coordinates.
export type NumberPair = [x: number, y: number]

export type Point<N extends PatternNumber> = [x: N, y: N]

// offset within pattern
export type RelativePoint = Point<RelativeNumber>

// absolute point in screen space
export type AbsolutePoint = Point<AbsoluteNumber>

// absolute point in viewport space
export type ViewportPoint = Point<ViewportNumber>

export type Size = [width: number, height: number]

export type Pattern<N extends PatternNumber> = {
  anchor: Point<N> // relative point representing base of new screen.
  target: Point<N> // relative point representing other corner of new screen. can have negative coordinates.
}

// represents a pattern in relative coordinates.
export type RelativePattern = Pattern<RelativeNumber>

// represents a pattern in absolute coordinates.
export type AbsolutePattern = Pattern<AbsoluteNumber>

// represents a pattern in viewport coordinates.
export type ViewportPattern = Pattern<ViewportNumber>

export type Boundaries<N extends PatternNumber> = {
  xMin: N
  xMax: N
  yMin: N
  yMax: N
}

export type State = {
  screens: AbsolutePattern[]
  patterns: RelativePattern[]
}
