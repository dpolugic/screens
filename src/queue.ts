/**
 * A fixed-size queue, backed by a circular buffer.
 */
export class Queue<T> {
  #buffer: (T | undefined)[] = []
  #head = 0
  #tail = 0
  #size = 0

  constructor({initialItems = [], size}: { initialItems?: T[], size: number}) {
    if (size <= 0) {
      throw new Error('Queue size must be positive')
    }

    if (initialItems.length > size) {
      throw new Error('Initial items exceed queue capacity')
    }

    this.#buffer = new Array(size).fill(undefined)

    for (let i = 0; i< initialItems.length; i++) {
      this.#buffer[i] = initialItems[i]
    }

    this.#size = initialItems.length
    this.#tail = initialItems.length
  }

  get size() {
    return this.#size
  }

  push(value: T) {
    if (this.#size === this.#buffer.length) {
      throw new Error('Queue is full')
    }

    this.#buffer[this.#tail] = value
    this.#tail = (this.#tail + 1) % this.#buffer.length
    this.#size++
  }

  shift(): T {
    if (this.#size === 0) {
      throw new Error('Queue is empty')
    }

    const value = this.#buffer[this.#head]!

    this.#head = (this.#head + 1) % this.#buffer.length
    this.#size--

    return value
  }

  clear() {
    this.#head = 0
    this.#tail = 0
    this.#size = 0
  }
}
