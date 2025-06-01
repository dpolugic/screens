import {
  applyMatrixAndOffsetToRectangle,
  combineTransformations,
  getMatrixAndOffsetFromRectangle,
  mapPatternToViewportSpace,
  mutateBoundariesFromPattern,
} from '../functions'
import { Queue } from '../queue'
import {
  AbsolutePoint,
  Boundaries,
  Size,
  State,
  Transformation,
  ViewportNumber,
  ViewportPattern,
} from '../types'
import { MAX_DEPTH, MAX_QUEUE_SIZE, MIN_PATTERN_SIZE_PX } from './constants'

// We'll ignore everything that's a bit outside the viewport.
// This is not really accurate, but should be OK for our purposes.

function getViewportBoundaries(screenSize: Size): Boundaries<ViewportNumber> {
  return {
    xMin: (-0.1 * screenSize[0]) as ViewportNumber,
    xMax: (1.1 * screenSize[0]) as ViewportNumber,
    yMin: (-0.1 * screenSize[1]) as ViewportNumber,
    yMax: (1.1 * screenSize[1]) as ViewportNumber,
  }
}

type QueueEntry = {
  currentTransformation: Transformation
  depth: number
}

type DrawablePattern = {
  pattern: ViewportPattern
  depth: number
}

// We'll use a global queue to avoid reallocating it on every preview frame.
const patternQueue = new Queue<QueueEntry>({
  initialItems: [],
  size: MAX_QUEUE_SIZE,
})

const isValidPattern = (() => {
  // Optimization: Only allocate boundaries object once and mutate it in place.
  // Make sure to update this object before using it!
  const patternBoundaries: Boundaries<ViewportNumber> = {
    xMin: 0 as ViewportNumber,
    xMax: 0 as ViewportNumber,
    yMin: 0 as ViewportNumber,
    yMax: 0 as ViewportNumber,
  }

  return function (pattern: ViewportPattern, viewportBoundaries: Boundaries<ViewportNumber>): boolean {
    mutateBoundariesFromPattern(pattern, patternBoundaries)

    return (
      // Pattern fulfills minimum size.
      patternBoundaries.xMax - patternBoundaries.xMin >= MIN_PATTERN_SIZE_PX &&
      patternBoundaries.yMax - patternBoundaries.yMin >= MIN_PATTERN_SIZE_PX &&
      // X and Y ranges overlap with the valid boundaries.
      // We will only render patterns if at least one corner is inside the valid boundaries.
      patternBoundaries.xMin <= viewportBoundaries.xMax &&
      patternBoundaries.xMax >= viewportBoundaries.xMin &&
      patternBoundaries.yMin <= viewportBoundaries.yMax &&
      patternBoundaries.yMax >= viewportBoundaries.yMin
    )
  }
})()

/**
 * Creates a generator that yields drawable patterns one by one.
 *
 * It starts with the initial screens and recursively applies all defined patterns
 * from the state. The generation proceeds in a breadth-first manner.
 */
export function* streamDrawablePatterns({
  state,
  screenSize,
}: {
  state: State
  screenSize: Size
}): Generator<DrawablePattern, void, void> {
  console.log(
    `generateDrawQueue start. Initial screens: ${state.screens.length}, Patterns: ${state.patterns.length}`
  )

  const viewportBoundaries = getViewportBoundaries(screenSize)

  patternQueue.clear()

  for (const screen of state.screens) {
    patternQueue.push({
      currentTransformation: getMatrixAndOffsetFromRectangle(screen),
      depth: 0,
    })

    yield {
      pattern: mapPatternToViewportSpace(screen, screenSize),
      depth: 0,
    }
  }

  let iterations = 0
  while (patternQueue.size > 0) {
    iterations += 1

    const entry = patternQueue.shift()

    // Don't add patterns that are too deep.
    if (entry.depth >= MAX_DEPTH) {
      console.log(
        `MAX_DEPTH (${MAX_DEPTH}) reached at depth ${entry.depth}. Breaking from generateDrawQueue loop.`
      )
      break
    }

    for (const { matrix, offset } of state.patterns) {
      // Get new pattern
      const newTransformation = combineTransformations(
        entry.currentTransformation.matrix,
        entry.currentTransformation.offset,
        matrix,
        offset
      )

      const transformedUnit = applyMatrixAndOffsetToRectangle(
        newTransformation.matrix,
        newTransformation.offset,
        {
          anchor: [0, 0] as AbsolutePoint,
          target: [1, 1] as AbsolutePoint,
        }
      )

      const newScreen = mapPatternToViewportSpace(transformedUnit, screenSize)

      if (isValidPattern(newScreen, viewportBoundaries)) {
        yield {
          pattern: newScreen,
          depth: entry.depth + 1,
        }

        patternQueue.push({
          currentTransformation: newTransformation,
          depth: entry.depth + 1,
        })

        // Give up if queue becomes too large.
        if (patternQueue.size >= MAX_QUEUE_SIZE) {
          console.log(
            `Maximum queue size reached. Rendering cancelled. Total iterations: ${iterations}. Final queue size: ${patternQueue.size}`
          )
          return
        }
      }
    }
  }

  console.log(
    `generateDrawQueue done. Total iterations: ${iterations}. Final queue size: ${patternQueue.size}`
  )
}
