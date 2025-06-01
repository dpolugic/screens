import React from 'react'
import { getBoundariesFromPattern } from './functions'
import { NumberPair, State } from './types'

function getViewBox(state: State): string {
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

  return `${xMin} ${yMin} ${xMax - xMin} ${yMax - yMin}`
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

export const Preview: React.FC<{ state: State }> = ({ state }) => {
  return (
    <div className='border-b-1 border-amber-300 aspect-square'>
      <svg viewBox={getViewBox(state)} xmlns='http://www.w3.org/2000/svg' className='w-full aspect-square'>
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

        {state.patterns.map(({ pattern }, i) => {
          const { xMin, xMax, yMin, yMax } = getBoundariesFromPattern(pattern)

          const width = xMax - xMin
          const height = yMax - yMin

          return (
            <React.Fragment key={i}>
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
              {[
                // top left
                { x: xMin, y: yMin, rotation: 0 },
                // top right
                { x: xMax, y: yMin, rotation: 90 },
                // bottom right
                { x: xMax, y: yMax, rotation: 180 },
                // bottom left
                { x: xMin, y: yMax, rotation: 270 },
              ].map(({ x, y, rotation }, j) => {
                const r_handle = 0.05 // Radius of the handle

                // Define the base handle shape (for top-left corner)
                // This creates a quarter-circle arc pointing outward from the corner
                const basePathD = `M 0 0 L -${r_handle} 0 A ${r_handle} ${r_handle} 0 0 1 0 -${r_handle} Z`

                return (
                  <g
                    key={`corner-handle-${i}-${j}`}
                    transform={`translate(${x.toFixed(3)}, ${y.toFixed(3)}) rotate(${rotation})`}
                  >
                    <path d={basePathD} className='fill-slate-400 hover:fill-blue-600 cursor-grab' />
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
