import { getScreenSize, mutateBoundariesFromPattern } from '../functions'
import { Boundaries, State, ViewportNumber } from '../types'
import { COLORS, DEBUG, MAX_DRAW_TIME_MS, MAX_PREVIEW_DRAW_CALLS, MIN_DEPTH } from './constants'
import PatternWorker from './patterns.worker?worker'
import { streamBatchedDrawablePatterns } from './stream-batched-drawable-patterns'

const patternWorker = new PatternWorker()
patternWorker.onmessage = event => {
  console.log(event.data)
}

patternWorker.postMessage({ type: 'generate' })

const measure = (f: () => void): number => {
  const start = performance.now()

  f()

  return performance.now() - start
}

export function* drawFrameIncrementally(
  ctx: CanvasRenderingContext2D,
  state: State
): Generator<void, void, void> {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  ctx.fillStyle = 'black'
  ctx.lineWidth = 1

  const screenSize = getScreenSize(ctx)

  const batchedPatternsIterator = streamBatchedDrawablePatterns({ state, chunkSize: 1000, screenSize })

  let iterations = 0

  while (true) {
    iterations += 1

    let drawScreenCalls = 0

    const duration = measure(() => {
      const start = performance.now()

      while (true) {
        const iteratorResult = batchedPatternsIterator.next()

        if (iteratorResult.done) break

        const { depth, patterns } = iteratorResult.value

        drawScreenCalls += patterns.length

        // Draw screen
        ctx.strokeStyle = COLORS[Math.min(COLORS.length - 1, depth)]!
        ctx.beginPath()

        // Optimization: Only allocate boundaries object once and mutate it in place.
        const boundaries: Boundaries<ViewportNumber> = {
          xMin: 0 as ViewportNumber,
          xMax: 0 as ViewportNumber,
          yMin: 0 as ViewportNumber,
          yMax: 0 as ViewportNumber,
        }

        for (const viewportPattern of patterns) {
          mutateBoundariesFromPattern(viewportPattern, boundaries)

          // Draw rectangle.
          ctx.rect(
            boundaries.xMin,
            boundaries.yMin,
            boundaries.xMax - boundaries.xMin,
            boundaries.yMax - boundaries.yMin
          )
        }

        ctx.fill()
        ctx.stroke()

        if (iterations === 1) {
          // On the first iteration, draw until passing both MIN_DEPTH and MAX_DRAW_CALLS.
          // We don't want to use a time-based limit here because it could cause flickering.
          if (depth > MIN_DEPTH && drawScreenCalls >= MAX_PREVIEW_DRAW_CALLS) {
            break
          }
        } else {
          // On subsequent iterations, draw until MAX_DRAW_TIME_MS is reached.
          if (performance.now() - start > MAX_DRAW_TIME_MS) {
            break
          }
        }
      }
    })

    if (DEBUG) {
      console.log(`drawFrame done in ${duration.toFixed(0)}ms. Drew ${drawScreenCalls} screens.`)
    }

    if (drawScreenCalls === 0) {
      console.log('No screens to draw. Exiting.')
      break
    }

    yield
  }
}

export function drawFramePreview(ctx: CanvasRenderingContext2D, state: State): void {
  const generator = drawFrameIncrementally(ctx, state)

  generator.next()
  generator.return()
}
