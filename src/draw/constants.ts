export const MAX_QUEUE_SIZE = 1e6
// const MIN_PATTERN_SIZE = 0.0005 // ignore patterns where either side is smaller than this
export const MIN_PATTERN_SIZE_PX = 1 // ignore patterns where either side is smaller than this// -- constants
const COLOR_SIZE = 50
export const COLORS = Array(COLOR_SIZE)
  .fill(undefined)
  .map((_, i) => {
    const frac = i / COLOR_SIZE

    const hue = (80 + 360 * frac) % 360
    const saturation = 50 + frac * 30
    const lightness = 60

    return `hsl(${hue} ${saturation}% ${lightness}%)`
  })
export const MIN_DEPTH = 3
export const MAX_DEPTH = Infinity
export const MAX_PREVIEW_DRAW_CALLS = 5e3 // number of shapes to draw per preview frame
export const MAX_DRAW_TIME_MS = 15 // how long to draw a frame in ms
export const DEBUG = true as boolean
