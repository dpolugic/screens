import { Size, State, ViewportPattern } from '../types'
import { streamDrawablePatterns } from './stream-drawable-patterns'

type Chunk = {
  depth: number
  patterns: ViewportPattern[]
}

/**
 * Creates a generator that groups drawable patterns from `streamDrawablePatterns` into chunks.
 *
 * Patterns are batched together based on their generation depth or a maximum
 * chunk size. This is useful for processing or rendering patterns in groups.
 *
 * @param state The current application state.
 * @param chunkSize The maximum number of patterns to include in a single chunk.
 * @param screenSize The current size of the screen/viewport.
 * @returns A generator yielding `Chunk` objects ({ depth: number, patterns: ViewportPattern[] }).
 */
export function* streamBatchedDrawablePatterns({
  state,
  chunkSize,
  screenSize,
}: {
  state: State
  chunkSize: number
  screenSize: Size
}): Generator<Chunk, void, void> {
  const drawQueueIterator = streamDrawablePatterns({ state, screenSize })

  let chunk: Chunk = {
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
