export class Queue<T> {
  #queue: T[] = []
  #head = 0
  #size = 0

  constructor(items: T[] = []) {
    this.#queue = items
    this.#size = items.length
  }

  get size() {
    return this.#size
  }

  push(value: T) {
    this.#queue.push(value)
    this.#size++
  }

  shift(): T {
    if (this.#size === 0) {
      throw new Error('Queue is empty')
    }

    const value = this.#queue[this.#head]!

    this.#head++
    this.#size--

    return value
  }

  /**
    * Compact the queue to make sure it doesn't grow indefinitely.
    * Must be triggered manually.
    * This is a naive approach and could be improved.
    * 
    * We could try using a circular buffer instead.
    */
  compact() {
    this.#queue = this.#queue.slice(this.#head)
    this.#head = 0
  }
}
