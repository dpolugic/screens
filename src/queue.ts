/**
 * A fixed-size queue, backed by a circular buffer.
 */
export class Queue<T> {
  private buffer: (T | undefined)[] = []
  private head = 0
  private tail = 0
  private _size = 0

  constructor({initialItems = [], size}: { initialItems?: T[], size: number}) {
    if (size <= 0) {
      throw new Error('Queue size must be positive')
    }

    if (initialItems.length > size) {
      throw new Error('Initial items exceed queue capacity')
    }

    this.buffer = new Array(size).fill(undefined)

    for (let i = 0; i< initialItems.length; i++) {
      this.buffer[i] = initialItems[i]
    }

    this._size = initialItems.length
    this.tail = initialItems.length
  }

  get size(): number {
    return this._size
  }

  push(value: T) {
    if (this._size === this.buffer.length) {
      throw new Error('Queue is full')
    }

    this.buffer[this.tail] = value
    this.tail = (this.tail + 1) % this.buffer.length
    this._size++
  }

  shift(): T {
    if (this._size === 0) {
      throw new Error('Queue is empty')
    }

    const value = this.buffer[this.head]!
    this.buffer[this.head] = undefined

    this.head = (this.head + 1) % this.buffer.length
    this._size--

    return value
  }

  clear() {
    for (let i = 0; i < this._size; i++) {
      this.buffer[(this.head + i) % this._size] = undefined
    }

    this.head = 0
    this.tail = 0
    this._size = 0
  }
}
