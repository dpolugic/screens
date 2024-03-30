export type Point = [x: number, y: number]

export type Line = [startPoint: Point, endPoint: Point]

export type Size = [width: number, height: number]

// this is a top-level screen. it has a location and size. patterns will be rendered
// recursively inside it.
export type Screen = {
  topLeft: Point
  topRight: Point
  bottomLeft: Point
  bottomRight: Point
}

export type BasePattern = {
  anchor: Point // relative point representing base of new screen.
  target: Point // relative point representing other corner of new screen. can have negative coordinates.
}

// this is what we'll render inside every screen instance, starting with top-level screens.
export type Pattern = BasePattern & {
  subpatterns: Pattern[]
}

export type Boundaries = {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
}

export type ScreenOverlap =
  | {
      type: 'lines'
      lines: Line[]
    }
  | {
      type: 'screen'
      screen: Screen
    }
  | {
      type: 'partial'
      screen: Screen
      crop: Boundaries
    }
