import { describe, it, expect } from 'vitest';
import { Queue } from './queue';



describe('Queue', () => {
  it('should initialize an empty queue', () => {
    const queue = new Queue<number>({ size: 5 });
    expect(queue.size).toBe(0);
  });

  it('should initialize a queue with initial items', () => {
    const queue = new Queue<number>({ initialItems: [1, 2, 3], size: 3 });
    expect(queue.size).toBe(3);
  });

  it('should throw an error if initial items exceed capacity', () => {
    expect(() => new Queue<number>({ initialItems: [1, 2, 3, 4], size: 3 })).toThrow('Initial items exceed queue capacity');
  });

  it('should push items to the queue up to its capacity', () => {
    const queue = new Queue<string>({ size: 2 });
    queue.push('a');
    expect(queue.size).toBe(1);
    queue.push('b');
    expect(queue.size).toBe(2);
  });

  it('should throw an error when pushing to a full queue', () => {
    const queue = new Queue<string>({ initialItems: ['a'], size: 1 });
    expect(() => queue.push('b')).toThrow('Queue is full');
  });

  it('should shift items from the queue in FIFO order', () => {
    const queue = new Queue<number>({ initialItems: [1, 2, 3], size: 3 });
    expect(queue.shift()).toBe(1);
    expect(queue.size).toBe(2);
    expect(queue.shift()).toBe(2);
    expect(queue.size).toBe(1);
    expect(queue.shift()).toBe(3);
    expect(queue.size).toBe(0);
  });

  it('should throw an error when shifting from an empty queue', () => {
    const queue = new Queue<number>({ size: 5 });
    expect(() => queue.shift()).toThrow('Queue is empty');
  });

  it('should handle a mix of push and shift operations correctly', () => {
    const queue = new Queue<string>({ size: 2 });
    queue.push('one');
    queue.push('two');
    expect(queue.shift()).toBe('one');
    queue.push('three');
    expect(queue.size).toBe(2);
    expect(queue.shift()).toBe('two');
    expect(queue.shift()).toBe('three');
    expect(queue.size).toBe(0);
  });

  it('should report correct size after multiple pushes and shifts', () => {
    const queue = new Queue<number>({ initialItems: [1, 2], size: 5 });
    queue.push(3);
    expect(queue.size).toBe(3);
    queue.shift();
    expect(queue.size).toBe(2);
    queue.push(4);
    expect(queue.size).toBe(3);
    expect(queue.shift()).toBe(2);
    expect(queue.shift()).toBe(3);
    expect(queue.shift()).toBe(4);
    expect(queue.size).toBe(0);
  });

  it('should allow pushing after shifting from a full queue', () => {
    const queue = new Queue<number>({ initialItems: [1, 2, 3], size: 3 });
    expect(queue.size).toBe(3);
    expect(queue.shift()).toBe(1);
    expect(queue.size).toBe(2);
    queue.push(4);
    expect(queue.size).toBe(3);
    expect(queue.shift()).toBe(2);
    expect(queue.shift()).toBe(3);
    expect(queue.shift()).toBe(4);
    expect(queue.size).toBe(0);
  });

  it('should throw if initializing with more items than queue size', () => {
    expect(() => new Queue<number>({ initialItems: [1, 2], size: 1 })).toThrow('Initial items exceed queue capacity');
  });

  it('should throw if initializing with non-positive size', () => {
    expect(() => new Queue<number>({ size: 0 })).toThrow('Queue size must be positive');
  });

  it('should handle operations on a queue of size 1', () => {
    const queue = new Queue<number>({ size: 1 });
    expect(queue.size).toBe(0);

    queue.push(10);
    expect(queue.size).toBe(1);
    expect(() => queue.push(20)).toThrow('Queue is full');

    expect(queue.shift()).toBe(10);
    expect(queue.size).toBe(0);
    expect(() => queue.shift()).toThrow('Queue is empty');

    queue.push(30);
    expect(queue.size).toBe(1);
    expect(queue.shift()).toBe(30);
  });

  it('should correctly handle fill-empty-fill-empty cycles (circular buffer integrity)', () => {
    const queue = new Queue<number>({ size: 3 });

    // Fill 1
    queue.push(1);
    queue.push(2);
    queue.push(3);
    expect(queue.size).toBe(3);
    expect(() => queue.push(4)).toThrow('Queue is full');

    // Empty 1
    expect(queue.shift()).toBe(1);
    expect(queue.shift()).toBe(2);
    expect(queue.shift()).toBe(3);
    expect(queue.size).toBe(0);
    expect(() => queue.shift()).toThrow('Queue is empty');

    // Fill 2 (after wrapping)
    queue.push(10);
    queue.push(20);
    queue.push(30);
    expect(queue.size).toBe(3);

    // Empty 2
    expect(queue.shift()).toBe(10);
    expect(queue.shift()).toBe(20);
    expect(queue.shift()).toBe(30);
    expect(queue.size).toBe(0);
  });
}); 
