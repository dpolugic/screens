import { expect, it } from 'vitest'
import {
  applyMatrixAndOffsetToRectangle,
  combinePatterns,
  getMatrixAndOffsetFromRectangle,
} from './functions'
import { AbsolutePoint, RelativePattern, RelativePoint } from './types'

it('should be able to apply anchor+target to a rectangle', () => {
  expect(
    combinePatterns(
      { anchor: [0, 0] as AbsolutePoint, target: [1, 1] as AbsolutePoint },
      { anchor: [0.2, 0.3] as RelativePoint, target: [0.4, 0.5] as RelativePoint }
    )
  ).toEqual({ anchor: [0.2, 0.3], target: [0.4, 0.5] })

  expect(
    combinePatterns(
      { anchor: [0, 0] as AbsolutePoint, target: [0.5, 0.5] as AbsolutePoint },
      { anchor: [0.2, 0.3] as RelativePoint, target: [0.4, 0.5] as RelativePoint }
    )
  ).toEqual({ anchor: [0.1, 0.15], target: [0.2, 0.25] })

  expect(
    combinePatterns(
      { anchor: [1, 1] as AbsolutePoint, target: [0, 0] as AbsolutePoint },
      { anchor: [0.2, 0.3] as RelativePoint, target: [0.4, 0.5] as RelativePoint }
    )
  ).toEqual({ anchor: [0.8, 0.7], target: [0.6, 0.5] })
})

it('should be able to apply matrix+offset to a rectangle', () => {
  expect(
    applyMatrixAndOffsetToRectangle([1, 0, 0, 1], [0, 0], {
      anchor: [0.2, 0.3] as RelativePoint,
      target: [0.4, 0.5] as RelativePoint,
    })
  ).toEqual({ anchor: [0.2, 0.3], target: [0.4, 0.5] })

  expect(
    applyMatrixAndOffsetToRectangle([1, 0, 0, 1], [1, 2], {
      anchor: [0.2, 0.3] as RelativePoint,
      target: [0.4, 0.5] as RelativePoint,
    })
  ).toEqual({ anchor: [1.2, 2.3], target: [1.4, 2.5] })

  expect(
    applyMatrixAndOffsetToRectangle([0.5, 0, 0, 0.5], [0, 0], {
      anchor: [0.2, 0.3] as RelativePoint,
      target: [0.4, 0.5] as RelativePoint,
    })
  ).toEqual({ anchor: [0.1, 0.15], target: [0.2, 0.25] })
})

it('should be able to convert from anchor+target to matrix+offset', () => {
  const basePattern = { anchor: [1, 2], target: [3, 4] } as RelativePattern

  const { matrix, offset } = getMatrixAndOffsetFromRectangle(basePattern)
  expect(matrix).toEqual([2, 0, 0, 2])
  expect(offset).toEqual([1, 2])

  const patternToConvert = {
    anchor: [0.7, 0.5],
    target: [0.8, 0.6],
  } as RelativePattern

  const matrixResult = applyMatrixAndOffsetToRectangle(matrix, offset, patternToConvert)
  const relativeResult = combinePatterns(basePattern, patternToConvert)

  expect(matrixResult).toEqual(relativeResult)
})

it('should handle identity transformation (unit square)', () => {
  const anchor = [0, 0] as RelativePoint
  const target = [1, 1] as RelativePoint

  const { matrix, offset } = getMatrixAndOffsetFromRectangle({ anchor, target })

  expect(matrix).toEqual([1, 0, 0, 1])
  expect(offset).toEqual([0, 0])

  // Test with a pattern
  const pattern = { anchor: [0.3, 0.4] as RelativePoint, target: [0.7, 0.8] as RelativePoint }
  const matrixResult = applyMatrixAndOffsetToRectangle(matrix, offset, pattern)
  const combineResult = combinePatterns({ anchor, target }, pattern)

  expect(matrixResult).toEqual(combineResult)
  expect(matrixResult).toEqual({ anchor: [0.3, 0.4], target: [0.7, 0.8] })
})

it('should handle negative scaling (flipped coordinates)', () => {
  const anchor = [1, 1] as RelativePoint
  const target = [0, 0] as RelativePoint

  const { matrix, offset } = getMatrixAndOffsetFromRectangle({ anchor, target })

  expect(matrix).toEqual([-1, 0, 0, -1])
  expect(offset).toEqual([1, 1])

  // Test with a pattern - should flip it
  const pattern = { anchor: [0.2, 0.3] as RelativePoint, target: [0.4, 0.5] as RelativePoint }
  const matrixResult = applyMatrixAndOffsetToRectangle(matrix, offset, pattern)
  const combineResult = combinePatterns({ anchor, target }, pattern)

  expect(matrixResult).toEqual(combineResult)
  expect(matrixResult).toEqual({ anchor: [0.8, 0.7], target: [0.6, 0.5] })
})

it('should handle non-uniform scaling', () => {
  const anchor = [0, 0] as RelativePoint
  const target = [2, 3] as RelativePoint

  const { matrix, offset } = getMatrixAndOffsetFromRectangle({ anchor, target })

  expect(matrix).toEqual([2, 0, 0, 3])
  expect(offset).toEqual([0, 0])

  // Test with a pattern
  const pattern = { anchor: [0.5, 0.5] as RelativePoint, target: [1, 1] as RelativePoint }
  const matrixResult = applyMatrixAndOffsetToRectangle(matrix, offset, pattern)
  const combineResult = combinePatterns({ anchor, target }, pattern)

  expect(matrixResult).toEqual(combineResult)
  expect(matrixResult).toEqual({ anchor: [1, 1.5], target: [2, 3] })
})

it('should handle translation without scaling', () => {
  const anchor = [5, 7] as RelativePoint
  const target = [6, 8] as RelativePoint

  const { matrix, offset } = getMatrixAndOffsetFromRectangle({ anchor, target })

  expect(matrix).toEqual([1, 0, 0, 1])
  expect(offset).toEqual([5, 7])

  // Test with a pattern
  const pattern = { anchor: [0, 0] as RelativePoint, target: [1, 1] as RelativePoint }
  const matrixResult = applyMatrixAndOffsetToRectangle(matrix, offset, pattern)
  const combineResult = combinePatterns({ anchor, target }, pattern)

  expect(matrixResult).toEqual(combineResult)
  expect(matrixResult).toEqual({ anchor: [5, 7], target: [6, 8] })
})

it('should handle fractional coordinates', () => {
  const anchor = [0.1, 0.2] as RelativePoint
  const target = [0.3, 0.7] as RelativePoint

  const { matrix, offset } = getMatrixAndOffsetFromRectangle({ anchor, target })

  // Use toBeCloseTo for floating-point comparisons
  expect(matrix[0]).toBeCloseTo(0.2)
  expect(matrix[1]).toBe(0)
  expect(matrix[2]).toBe(0)
  expect(matrix[3]).toBeCloseTo(0.5)
  expect(offset).toEqual([0.1, 0.2])

  // Test with a pattern
  const pattern = { anchor: [0.5, 0.4] as RelativePoint, target: [1, 0.8] as RelativePoint }
  const matrixResult = applyMatrixAndOffsetToRectangle(matrix, offset, pattern)
  const combineResult = combinePatterns({ anchor, target }, pattern)

  expect(matrixResult).toEqual(combineResult)
  expect(matrixResult.anchor[0]).toBeCloseTo(0.2)
  expect(matrixResult.anchor[1]).toBeCloseTo(0.4)
  expect(matrixResult.target[0]).toBeCloseTo(0.3)
  expect(matrixResult.target[1]).toBeCloseTo(0.6)
})

it('should handle edge case with zero-sized dimensions', () => {
  const anchor = [1, 1] as RelativePoint
  const target = [1, 2] as RelativePoint // zero width, height of 1

  const { matrix, offset } = getMatrixAndOffsetFromRectangle({ anchor, target })

  expect(matrix).toEqual([0, 0, 0, 1])
  expect(offset).toEqual([1, 1])

  // Test with a pattern
  const pattern = { anchor: [0.5, 0.5] as RelativePoint, target: [0.8, 0.9] as RelativePoint }
  const matrixResult = applyMatrixAndOffsetToRectangle(matrix, offset, pattern)
  const combineResult = combinePatterns({ anchor, target }, pattern)

  expect(matrixResult).toEqual(combineResult)
  expect(matrixResult).toEqual({ anchor: [1, 1.5], target: [1, 1.9] })
})

it('should work with multiple different patterns', () => {
  const anchor = [2, 3] as RelativePoint
  const target = [4, 5] as RelativePoint

  const { matrix, offset } = getMatrixAndOffsetFromRectangle({ anchor, target })

  const patterns = [
    { anchor: [0, 0] as RelativePoint, target: [1, 1] as RelativePoint },
    { anchor: [0.25, 0.25] as RelativePoint, target: [0.75, 0.75] as RelativePoint },
    { anchor: [0.1, 0.9] as RelativePoint, target: [0.9, 0.1] as RelativePoint },
  ]

  patterns.forEach(pattern => {
    const matrixResult = applyMatrixAndOffsetToRectangle(matrix, offset, pattern)
    const combineResult = combinePatterns({ anchor, target }, pattern)
    expect(matrixResult).toEqual(combineResult)
  })
})

it('should maintain consistency across different coordinate systems', () => {
  const testCases = [
    { anchor: [0, 0] as RelativePoint, target: [10, 10] as RelativePoint },
    { anchor: [-5, -5] as RelativePoint, target: [5, 5] as RelativePoint },
    { anchor: [100, 200] as RelativePoint, target: [300, 400] as RelativePoint },
    { anchor: [0.001, 0.002] as RelativePoint, target: [0.003, 0.004] as RelativePoint },
  ]

  testCases.forEach(({ anchor, target }) => {
    const { matrix, offset } = getMatrixAndOffsetFromRectangle({ anchor, target })

    const testPattern = { anchor: [0.3, 0.7] as RelativePoint, target: [0.6, 0.9] as RelativePoint }
    const matrixResult = applyMatrixAndOffsetToRectangle(matrix, offset, testPattern)
    const combineResult = combinePatterns({ anchor, target }, testPattern)

    expect(matrixResult).toEqual(combineResult)
  })
})
