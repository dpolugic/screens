export type Point = [x: number, y: number]

export type Size = [width: number, height: number]

// this is what we'll render inside every screen instance, starting with top-level screens.
export type Pattern = {
  anchor: Point // relative point representing base of new screen.
  target: Point // relative point representing other corner of new screen. can have negative coordinates.
}

export type Boundaries = {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
}
