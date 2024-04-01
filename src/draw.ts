import {
  combinePatterns,
  getBoundariesFromPattern,
  getScreenSize,
  mapPointToViewportSpace,
  pointIsInBoundaries,
} from './functions'
import { AbsolutePattern, Pattern, Point, Size, State } from './types'

// -- constants

// todo: handle colors in a better way
const COLORS = '0123456789abcdef'
  .split('')
  .reverse()
  .map(a => `#fa${a}`)

const MIN_DEPTH = 3
const MAX_DEPTH = Infinity
const MAX_DRAW_CALLS = 1e4
const MAX_QUEUE_SIZE = 1e6
const SIZE_LIMIT = 0.001
const DEBUG = true as boolean

// -- hacky global state

type GlobalMutableState = {
  drawScreenCalls: number
  maxQueueSize: number
  queueIterations: number
}

// -- helper functions

const mapPatternToViewportSpace = (pattern: AbsolutePattern, screenSize: Size): Pattern => ({
  anchor: mapPointToViewportSpace(pattern.anchor, screenSize),
  target: mapPointToViewportSpace(pattern.target, screenSize),
})

const getPatternPoints = (pattern: Pattern): Point[] => {
  const { xMin, xMax, yMin, yMax } = getBoundariesFromPattern(pattern)

  return [
    [xMin, yMin], // top left
    [xMax, yMin], // top right
    [xMax, yMax], // bottom right
    [xMin, yMax], // bottom left
  ]
}

const isPatternOutOfBounds = (pattern: AbsolutePattern): boolean => {
  // We'll ignore everything more than 1 viewport size away.
  // This is not fully accurate, but should be OK for most purposes.
  return !getPatternPoints(pattern).some(p =>
    pointIsInBoundaries(p, {
      xMin: -1,
      xMax: 2,
      yMin: -1,
      yMax: 2,
    })
  )
}

const isPatternTooSmall = (pattern: AbsolutePattern): boolean => {
  const boundaries = getBoundariesFromPattern(pattern)
  return boundaries.xMax - boundaries.xMin < SIZE_LIMIT || boundaries.yMax - boundaries.yMin < SIZE_LIMIT
}

const isValidPattern = (pattern: AbsolutePattern): boolean => {
  return !isPatternTooSmall(pattern) && !isPatternOutOfBounds(pattern)
}

const measure = (f: () => void): number => {
  const start = performance.now()

  f()

  return performance.now() - start
}

// ---

const drawScreen = (
  ctx: CanvasRenderingContext2D,
  absolutePattern: AbsolutePattern,
  strokeStyle: string
): void => {
  const viewportPattern = mapPatternToViewportSpace(absolutePattern, getScreenSize(ctx))
  const [p1, p2, p3, p4] = getPatternPoints(viewportPattern)

  ctx.lineWidth = 1
  ctx.strokeStyle = strokeStyle
  ctx.fillStyle = 'black'

  ctx.beginPath()
  ctx.moveTo(...p1)
  ctx.lineTo(...p2)
  ctx.lineTo(...p3)
  ctx.lineTo(...p4)
  ctx.closePath()

  ctx.fill()
  ctx.stroke()
}

export type RenderOptions = {
  reset: boolean
}

type QueueEntry = {
  currentPattern: AbsolutePattern
  depth: number
}

const draw = (
  ctx: CanvasRenderingContext2D,
  state: State,
  globalMutableState: GlobalMutableState,
  queue: QueueEntry[]
): void => {
  while (queue.length > 0) {
    globalMutableState.queueIterations += 1
    const { currentPattern, depth } = queue.shift()!

    if (depth > MAX_DEPTH) break
    // Always render to MIN_DEPTH even if the draw call budget is empty
    if (depth > MIN_DEPTH && globalMutableState.drawScreenCalls >= MAX_DRAW_CALLS) break

    globalMutableState.drawScreenCalls += 1
    drawScreen(ctx, currentPattern, COLORS[Math.min(COLORS.length - 1, depth)])

    for (const pattern of state.patterns) {
      const virtualScreen = combinePatterns(currentPattern, pattern)

      if (isValidPattern(virtualScreen)) {
        queue.push({
          currentPattern: virtualScreen,
          depth: depth + 1,
        })
      }
    }

    globalMutableState.maxQueueSize = Math.max(globalMutableState.maxQueueSize, queue.length)
  }
}

let drawQueue: QueueEntry[] = []

export type DrawFrameResult = { done: boolean }

export const drawFrame = (
  ctx: CanvasRenderingContext2D,
  state: State,
  options: RenderOptions
): DrawFrameResult => {
  const globalMutableState: GlobalMutableState = {
    drawScreenCalls: 0,
    maxQueueSize: 0,
    queueIterations: 0,
  }

  const duration = measure(() => {
    if (options.reset) {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
      drawQueue = state.screens.map(screen => ({
        currentPattern: screen,
        depth: 0,
      }))
      globalMutableState.maxQueueSize = drawQueue.length
    }

    draw(ctx, state, globalMutableState, drawQueue)
  })

  if (DEBUG) {
    console.log(
      `drawFrame done in ${duration.toFixed(0)}ms. Queue size: ${drawQueue.length}. ${JSON.stringify(globalMutableState)}.`
    )
  }

  // Cancel everything if queue becomes too large
  if (drawQueue.length > MAX_QUEUE_SIZE) {
    drawQueue = []
    return { done: true }
  }

  return {
    done: drawQueue.length === 0,
  }
}
