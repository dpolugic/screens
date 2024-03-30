export type Point = [x: number, y: number]

export type Line = [startPoint: Point, endPoint: Point]

export type Size = [width: number, height: number]

export type Screen = {
  topLeft: Point
  topRight: Point
  bottomLeft: Point
  bottomRight: Point
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
