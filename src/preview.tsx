import { getBoundariesFromPattern } from './functions'
import { State } from './types'

export const Preview: React.FC<{ state: State }> = ({ state }) => {
  return (
    <div className='border-1 border-amber-300 aspect-square'>
      <svg viewBox='0 0 1 1' xmlns='http://www.w3.org/2000/svg' className='w-full aspect-square'>
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
