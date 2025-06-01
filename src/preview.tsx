import React, { useMemo, useState } from 'react'
import { getBoundariesFromPattern } from './functions'
import { NumberPair, PatternId, RelativePattern, RelativePoint, State } from './types'

function getViewBox(state: State): { x: number; y: number; width: number; height: number } {
  let xMin = 0
  let xMax = 1
  let yMin = 0
  let yMax = 1

  // Make sure that default viewBox contains entire pattern
  for (const { pattern } of state.patterns) {
    const b = getBoundariesFromPattern(pattern)

    xMin = Math.min(xMin, b.xMin)
    xMax = Math.max(xMax, b.xMax)
    yMin = Math.min(yMin, b.yMin)
    yMax = Math.max(yMax, b.yMax)
  }

  // Add some spacing around the bounding box
  xMin -= 0.1
  xMax += 0.1
  yMin -= 0.1
  yMax += 0.1

  return { x: xMin, y: yMin, width: xMax - xMin, height: yMax - yMin }
}

function isMirroredX(pattern: RelativePattern): boolean {
  return pattern.anchor[0] > pattern.target[0]
}

function isMirroredY(pattern: RelativePattern): boolean {
  return pattern.anchor[1] > pattern.target[1]
}

function lerp(a: number, b: number, k: number): number {
  return a + (b - a) * k
}

const PartialLine: React.FC<{ anchor: NumberPair; target: NumberPair }> = ({ anchor, target }) => {
  const [anchorX, anchorY] = anchor
  const [targetX, targetY] = target

  const k = 0.2

  const x1 = anchorX
  const y1 = anchorY
  const x2 = lerp(anchorX, targetX, k)
  const y2 = lerp(anchorY, targetY, k)

  return (
    <line
      className='stroke-amber-100'
      vectorEffect='non-scaling-stroke'
      strokeWidth='1px'
      x1={x1.toFixed(3)}
      y1={y1.toFixed(3)}
      x2={x2.toFixed(3)}
      y2={y2.toFixed(3)}
    />
  )
}

type Corner = 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left'

export const Preview: React.FC<{
  state: State
  updatePattern: (id: PatternId, pattern: RelativePattern) => void
}> = ({ state: _state, updatePattern }) => {
  const [svgEl, setSvgEl] = useState<SVGSVGElement | null>(null)
  const [resizeState, setResizeState] = useState<
    | {
        id: PatternId
        initialPattern: RelativePattern
        pattern: RelativePattern
        corner: Corner
        initialMouseViewportX: number
        initialMouseViewportY: number
      }
    | undefined
  >(undefined)

  const state = useMemo(() => {
    if (resizeState === undefined) {
      return _state
    }

    const { id, pattern } = resizeState

    const prev = _state.patterns.find(p => p.id === id)

    if (!prev) {
      throw new Error(`Pattern with id ${id} not found`)
    }

    return {
      ..._state,
      patterns: _state.patterns.map(p => (p.id === id ? { ...p, pattern } : p)),
    }
  }, [_state, resizeState])

  const viewBox = getViewBox(_state)

  return (
    <div className='border-b-1 border-amber-300 aspect-square'>
      <svg
        ref={setSvgEl}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        xmlns='http://www.w3.org/2000/svg'
        className='w-full aspect-square'
        onPointerMove={e => {
          e.preventDefault()

          if (svgEl === null || resizeState === undefined) {
            return
          }

          const { initialPattern, initialMouseViewportX, initialMouseViewportY, corner } = resizeState

          const { width: svgWidth, height: svgHeight } = svgEl.getBoundingClientRect()
          const { clientX: mouseViewportX, clientY: mouseViewportY } = e

          // Calculate movement delta in viewport coordinates
          const viewportDeltaX = mouseViewportX - initialMouseViewportX
          const viewportDeltaY = mouseViewportY - initialMouseViewportY

          // Convert viewport delta to SVG coordinate delta
          const svgDeltaX = (viewportDeltaX / svgWidth) * viewBox.width
          const svgDeltaY = (viewportDeltaY / svgHeight) * viewBox.height

          let {
            xMin,
            xMax,
            yMin,
            yMax,
          }: {
            xMin: number
            xMax: number
            yMin: number
            yMax: number
          } = getBoundariesFromPattern(initialPattern)

          if (corner === 'top-left') {
            // Dragging top-left, bottom-right is fixed
            xMin += svgDeltaX
            yMin += svgDeltaY
          } else if (corner === 'top-right') {
            // Dragging top-right, bottom-left is fixed
            xMax += svgDeltaX
            yMin += svgDeltaY
          } else if (corner === 'bottom-right') {
            // Dragging bottom-right, top-left is fixed
            xMax += svgDeltaX
            yMax += svgDeltaY
          } else {
            // Dragging bottom-left, top-right is fixed
            xMin += svgDeltaX
            yMax += svgDeltaY
          }

          // Calculate new anchor and target based on their relative positions in the new box
          const newPattern: RelativePattern = {
            anchor: [xMin, yMin] satisfies NumberPair as RelativePoint,
            target: [xMax, yMax] satisfies NumberPair as RelativePoint,
          }

          // Mirror X if mirrored in the initial pattern
          if (isMirroredX(initialPattern)) {
            ;[newPattern.anchor[0], newPattern.target[0]] = [newPattern.target[0], newPattern.anchor[0]]
          }

          // Mirror Y if mirrored in the initial pattern
          if (isMirroredY(initialPattern)) {
            ;[newPattern.anchor[1], newPattern.target[1]] = [newPattern.target[1], newPattern.anchor[1]]
          }

          setResizeState(prev =>
            prev === undefined
              ? undefined
              : {
                  ...prev,
                  pattern: newPattern,
                }
          )
        }}
        onPointerUp={e => {
          e.preventDefault()

          if (resizeState !== undefined) {
            const { id, pattern: newPattern } = resizeState

            if (
              newPattern.anchor[0] === newPattern.target[0] ||
              newPattern.anchor[1] === newPattern.target[1]
            ) {
              console.error('Anchor and target cannot be the same')
            } else {
              updatePattern(id, newPattern)
            }
          }

          setResizeState(undefined)
        }}
        onPointerLeave={e => {
          e.preventDefault()

          setResizeState(undefined)
        }}
        onPointerCancel={e => {
          e.preventDefault()

          setResizeState(undefined)
        }}
        // onPointerOut={e => {
        //   e.preventDefault()

        //   setResizeState(undefined)
        // }}
      >
        <rect
          className='stroke-amber-100'
          vectorEffect='non-scaling-stroke'
          fill='none'
          strokeWidth='2px'
          x={0}
          y={0}
          width={1}
          height={1}
        />
        <PartialLine anchor={[0, 0]} target={[1, 1]} />

        {state.patterns.map(({ id, pattern }) => {
          const { xMin, xMax, yMin, yMax } = getBoundariesFromPattern(pattern)

          const width = xMax - xMin
          const height = yMax - yMin

          return (
            <React.Fragment key={id}>
              <rect
                className='stroke-amber-100'
                vectorEffect='non-scaling-stroke'
                fill='none'
                strokeWidth='1px'
                x={xMin.toFixed(3)}
                y={yMin.toFixed(3)}
                width={width.toFixed(3)}
                height={height.toFixed(3)}
              />
              {/* Partial line from anchor to target in order to show the direction */}
              <PartialLine anchor={pattern.anchor} target={pattern.target} />

              {/* Click surfaces for rotation and resizing actions */}
              {(
                [
                  // top left
                  { x: xMin, y: yMin, rotation: 0, corner: 'top-left' },
                  // top right
                  { x: xMax, y: yMin, rotation: 90, corner: 'top-right' },
                  // bottom right
                  { x: xMax, y: yMax, rotation: 180, corner: 'bottom-right' },
                  // bottom left
                  { x: xMin, y: yMax, rotation: 270, corner: 'bottom-left' },
                ] as const
              ).map(({ x, y, rotation, corner }) => {
                const r_handle = 0.07 // Radius of the handle

                // Define the base handle shape (for top-left corner)
                // This creates a quarter-circle arc pointing outward from the corner
                const basePathD = `M 0 0 L -${r_handle} 0 A ${r_handle} ${r_handle} 0 0 1 0 -${r_handle} Z`

                return (
                  <g
                    key={`corner-handle-${id}-${corner}`}
                    transform={`translate(${x.toFixed(3)}, ${y.toFixed(3)}) rotate(${rotation})`}
                    onPointerDown={e => {
                      e.preventDefault()

                      setResizeState({
                        id,
                        initialPattern: pattern,
                        pattern,
                        corner,
                        initialMouseViewportX: e.clientX,
                        initialMouseViewportY: e.clientY,
                      })
                    }}
                  >
                    <path
                      d={basePathD}
                      className={
                        'fill-slate-400 hover:fill-blue-600 cursor-grab' +
                        // Force hover color while dragging.
                        (resizeState?.id === id && resizeState?.corner === corner ? ' fill-blue-600!' : '')
                      }
                    />
                  </g>
                )
              })}
            </React.Fragment>
          )
        })}
      </svg>
    </div>
  )
}
