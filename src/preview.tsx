import { getBoundariesFromPattern } from './functions'
import { State } from './types'

export const Preview: React.FC<{ state: State }> = ({ state }) => {
  const viewBox = (() => {
    let xMin = 0
    let xMax = 1
    let yMin = 0
    let yMax = 1

    // Make sure that default viewBox contains entire pattern
    for (const p of state.patterns) {
      const b = getBoundariesFromPattern(p)

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
  })()

  return (
    <div className='border-1 border-amber-300 aspect-square'>
      <svg viewBox={viewBox} xmlns='http://www.w3.org/2000/svg' className='w-full aspect-square'>
        <rect
          className='stroke-amber-100'
          vectorEffect='non-scaling-stroke'
          fill='none'
          strokeWidth='1px'
          x={0}
          y={0}
          width={1}
          height={1}
        />
        {state.patterns.map((p, i) => {
          const { xMin, xMax, yMin, yMax } = getBoundariesFromPattern(p)

          return (
            <rect
              key={i}
              className='stroke-amber-100'
              vectorEffect='non-scaling-stroke'
              fill='none'
              strokeWidth='1px'
              x={xMin.toFixed(3)}
              y={yMin.toFixed(3)}
              width={(xMax - xMin).toFixed(3)}
              height={(yMax - yMin).toFixed(3)}
            />
          )
        })}
      </svg>
    </div>
  )
}
