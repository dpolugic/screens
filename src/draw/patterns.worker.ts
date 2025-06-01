import { AbsolutePattern, RelativePattern, State, ViewportPattern } from '../types'
import { streamBatchedDrawablePatterns } from './stream-batched-drawable-patterns'

type WorkerState =
  | {
      type: 'stopped'
    }
  | {
      type: 'generating'
      state: State
    }

type WorkerMessageInput =
  | {
      type: 'initialize'
      ctx: OffscreenCanvasRenderingContext2D
    }
  | {
      type: 'generate'
      state: State
    }
  | {
      type: 'stop'
    }

type WorkerMessageOutput =
  | {
      type: 'batch'
      depth: number
      patterns: ViewportPattern[]
    }
  | {
      type: 'done'
    }

let state: WorkerState = {
  type: 'stopped',
}

function handleMessage(message: WorkerMessageInput) {
  switch (message.type) {
    case 'generate': {
      if (state.type === 'generating') {
        console.warn('Already generating patterns')
        break
      }

      // Start generating patterns
      state = {
        type: 'generating',
        state: message.state,
      }
      generatePatterns()
      break
    }
    case 'stop': {
      state = {
        type: 'stopped',
      }
      break
    }
    default: {
      console.warn('Unknown message:', message)
    }
  }
}

function sendMessage(message: WorkerMessageOutput) {
  self.postMessage(message)
}

self.onmessage = event => {
  console.log('worker.onmessage', event.data, state)
  handleMessage(event.data)
}

function generatePatterns() {
  for (const { depth, patterns } of streamBatchedDrawablePatterns({
    state: {
      patterns: [{ id: 'debug', pattern: { anchor: [0, 0], target: [0.5, 0.5] } as RelativePattern }],
      screens: [{ anchor: [0.2, 0.2], target: [0.8, 0.8] } as AbsolutePattern],
    },
    chunkSize: 5,
    screenSize: [600, 400],
  })) {
    if (state.type !== 'generating') {
      break
    }

    sendMessage({
      type: 'batch',
      depth,
      patterns,
    })
  }

  sendMessage({
    type: 'done',
  })
}
