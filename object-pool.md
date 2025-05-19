# Object Pooling for ViewportPattern: Summary

This document summarizes the investigation into using an object pool to optimize `ViewportPattern` allocations and reduce Garbage Collection (GC) overhead.

## Problem

- Profiling has indicated significant GC pauses related to the frequent allocation and deallocation of `ViewportPattern` objects.
- The `combinePatterns` function, in particular, has been identified as a hotspot for these allocations.

## Proposed Solution: Object Pooling

The proposed solution is to implement an object pool for `ViewportPattern` objects. This involves reusing `ViewportPattern` instances rather than creating new ones for each operation.

## Structural Analysis

- The `ViewportPattern` type is defined as `Pattern<ViewportNumber>`, which consists of an `anchor: Point<ViewportNumber>` and a `target: Point<ViewportNumber>`.
- `Point<N>` is a two-element array `[x: N, y: N]`.
- This simple and fixed structure makes `ViewportPattern` (and its constituent `Point`s) well-suited for object pooling.

## Necessary Code Modifications

1.  **Create `ViewportPatternPool` Class:**

    - Implement a class (e.g., in `src/object-pool.ts`) with:
      - `acquire(): ViewportPattern`: Retrieves an available `ViewportPattern` from the pool or creates a new one (up to a configurable limit).
      - `release(pattern: ViewportPattern)`: Returns a `ViewportPattern` to the pool, making it available for reuse.
    - The pool would internally manage a list of `ViewportPattern` instances. Pooled patterns would have their `anchor` and `target` `Point` arrays pre-allocated.

2.  **Modify Core Functions to Mutate Output Parameters:**

    - Update functions that currently return new `ViewportPattern` or `Point` instances to accept an optional `out` parameter. If provided, these functions will mutate the `out` object/array instead of allocating a new one.
    - **Point Manipulation Functions (e.g., in `src/functions.ts`):**
      - `mapPointToViewportSpace(point, screenSize, outPoint: ViewportPoint)`
      - `resolveRelativePointPosition(relativePoint, pattern, outPoint: Point<N>)` (or adapt `resolveRelativePointPositionInPlace`)
    - **Pattern Manipulation Functions (e.g., in `src/functions.ts`):**
      - `mapPatternToViewportSpace(pattern, screenSize, outPattern: ViewportPattern)`
      - `combinePatterns(parent, child, outPattern: Pattern<ParentNumber>)`
    - These functions would then modify `outPattern.anchor`, `outPattern.target`, `outPoint[0]`, `outPoint[1]` directly.

3.  **Integrate Pool into `streamDrawablePatterns` (in `src/draw/stream-drawable-patterns.ts`):**

    - Instantiate or import a global `ViewportPatternPool`.
    - **Acquire:** Before calling `mapPatternToViewportSpace` (for initial screens) or `combinePatterns` (in the generation loop), acquire a `ViewportPattern` from the pool.
      ```typescript
      // const newViewportPattern = combinePatterns(entry.currentPattern, pattern); // OLD
      const pooledPattern = globalViewportPatternPool.acquire()
      const newViewportPattern = combinePatterns(entry.currentPattern, pattern, pooledPattern)
      ```
    - **Release:** After a `ViewportPattern` is no longer needed (i.e., after its `QueueEntry` is processed and it has been used to generate children patterns, or if `isValidPattern` returns false and the pattern is discarded), release it back to the pool.

      ```typescript
      // yield entry; // OLD
      // ...
      // // After entry.currentPattern is fully processed:
      // globalViewportPatternPool.release(entry.currentPattern);

      // If a newly combined pattern is not valid:
      if (isValidPattern(newViewportPattern, viewportBoundaries)) {
        // ... push to queue ...
      } else {
        globalViewportPatternPool.release(newViewportPattern) // Release if not used
      }
      ```

    - Care must be taken to ensure patterns are released exactly once and only when they are no longer in use.

## Trade-offs

- **Benefits:**
  - Reduced GC pressure, leading to fewer and shorter GC pauses.
  - Potentially improved overall performance and smoother rendering, especially in the pattern generation loop.
- **Costs:**
  - **Increased Code Complexity:** Introduces manual memory management aspects (acquire/release).
  - **New Bug Class:** Risk of bugs related to incorrect pool usage (e.g., double-release, use-after-release, pool exhaustion if releases are missed).
  - **Function Signature Changes:** Core utility functions will have modified signatures.

## Conclusion

Pooling `ViewportPattern` objects is a viable strategy for addressing the identified GC performance issues. While it introduces complexity, the potential performance gains in the critical pattern generation path could be significant. Careful implementation of the pool and the acquire/release logic is paramount.
