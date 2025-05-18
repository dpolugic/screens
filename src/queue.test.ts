import { describe, it, expect } from 'vitest';
import { Queue } from './queue';



describe('Queue', () => {
  it('should initialize an empty queue', () => {
    const queue = new Queue<number>();
    expect(queue.size).toBe(0);
  });

  it('should initialize a queue with initial items', () => {
    const queue = new Queue<number>([1, 2, 3]);
    expect(queue.size).toBe(3);
  });

  it('should push items to the queue', () => {
    const queue = new Queue<string>();
    queue.push('a');
    expect(queue.size).toBe(1);
    queue.push('b');
    expect(queue.size).toBe(2);
  });

  it('should shift items from the queue in FIFO order', () => {
    const queue = new Queue<number>([1, 2, 3]);
    expect(queue.shift()).toBe(1);
    expect(queue.size).toBe(2);
    expect(queue.shift()).toBe(2);
    expect(queue.size).toBe(1);
    expect(queue.shift()).toBe(3);
    expect(queue.size).toBe(0);
  });

  it('should throw an error when shifting from an empty queue', () => {
    const queue = new Queue<number>();
    expect(() => queue.shift()).toThrow('Queue is empty');
  });

  it('should handle a mix of push and shift operations correctly', () => {
    const queue = new Queue<string>();
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
    const queue = new Queue<number>([1, 2]);
    queue.push(3);
    expect(queue.size).toBe(3);
    queue.shift(); // 1
    expect(queue.size).toBe(2);
    queue.push(4);
    expect(queue.size).toBe(3);
    expect(queue.shift()).toBe(2);
    expect(queue.shift()).toBe(3);
    expect(queue.shift()).toBe(4);
    expect(queue.size).toBe(0);
  });
}); 
