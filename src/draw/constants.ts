/** Rendering is aborted if the queue size exceeds this. */
export const MAX_QUEUE_SIZE = 1e6

/** Ignore patterns where either side is smaller than this. */
export const MIN_PATTERN_SIZE_PX = 1

/** Number of colors to use. */
const COLOR_SIZE = 50

/** Colors to use. Depths past `COLOR_SIZE` use the last color in the array. */
export const COLORS = Array(COLOR_SIZE)
  .fill(undefined)
  .map((_, i) => {
    const frac = i / COLOR_SIZE

    const hue = (80 + 360 * frac) % 360
    const saturation = 50 + frac * 30
    const lightness = 60

    return `hsl(${hue} ${saturation}% ${lightness}%)`
  })

/** Always render to at least this depth in the initial frame. */
export const MIN_DEPTH = 3

/** Never render past this depth. `Infinity` means no limit. */
export const MAX_DEPTH = Infinity

/** Maximum number of draw calls per preview frame. */
export const MAX_PREVIEW_DRAW_CALLS = 5e3

/** Maximum time to draw a frame in ms. */
export const MAX_DRAW_TIME_MS = 15

/** Whether to enable debug logging. */
export const DEBUG = true as boolean
