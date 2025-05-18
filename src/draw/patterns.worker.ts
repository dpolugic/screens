import { State, ViewportPattern } from '../types'

type WorkerState =
  | {
      type: 'idle'
    }
  | {
      type: 'generating'
      state: State
    }
  | {
      type: 'paused'
      state: State
    }

type WorkerMessageInput =
  | {
      type: 'generate'
      state: State
    }
  | {
      type: 'stop'
    }
  | {
      type: 'pause'
    }
  | {
      type: 'resume'
    }

type WorkerMessageOutput = {
  type: 'batch'
  patterns: ViewportPattern[]
}

let state: WorkerState = {
  type: 'idle',
}

function handleMessage(message: WorkerMessageInput) {
  switch (message.type) {
    case 'generate': {
      // Start generating patterns
      state = {
        type: 'generating',
        state: message.state,
      }
      generatePatterns()
      break
    }
    case 'stop': {
      // Stop
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
  // Post batches of patterns back to main thread
  sendMessage({
    type: 'batch',
    patterns: [], // TODO: Generate actual patterns
  })
}
