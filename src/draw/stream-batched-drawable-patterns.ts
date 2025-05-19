import { Size, State, ViewportPattern } from '../types'
import { streamDrawablePatterns } from './stream-drawable-patterns'

type DrawableChunk = {
  depth: number
  patterns: ViewportPattern[]
}

/**
 * Creates a generator that groups drawable patterns from {@link streamDrawablePatterns} into chunks.
 *
 * Patterns are batched together based on their generation depth or a maximum
 * chunk size. This is useful for processing or rendering patterns in groups.
 */
export function* streamBatchedDrawablePatterns({
  state,
  chunkSize,
  screenSize,
}: {
  state: State
  chunkSize: number
  screenSize: Size
}): Generator<DrawableChunk, void, void> {
  const drawQueueIterator = streamDrawablePatterns({ state, screenSize })

  let chunk: DrawableChunk = {
    depth: 0,
    patterns: [],
  }

  for (const entry of drawQueueIterator) {
    if (chunk.depth !== entry.depth) {
      if (chunk.patterns.length > 0) {
        yield chunk
      }

      chunk = {
        depth: entry.depth,
        patterns: [entry.currentPattern],
      }
    } else {
      chunk.patterns.push(entry.currentPattern)

      if (chunk.patterns.length >= chunkSize) {
        yield chunk
        chunk = {
          depth: entry.depth,
          patterns: [],
        }
      }
    }
  }

  if (chunk.patterns.length > 0) {
    yield chunk
  }
}
