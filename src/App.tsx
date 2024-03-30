import { useEffect, useMemo, useRef, useState } from 'react'

import styled from 'styled-components'
import { drawFrame } from './draw'
import {
  findClickedScreenOrPattern,
  getBoundariesFromTwoPoints,
  getMousePoint,
  getRelativePointPosition,
  getScreenBoundaries,
  getScreenFromTwoPoints,
} from './functions'
import { Pattern, Point, Screen } from './types'

const StyledCanvas = styled.canvas`
  /* border: 1px solid #faf; */
  display: block;
  width: 100%;
  height: 100%;
`

function App() {
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null)
  const mousePositionRef = useRef<Point>([0, 0])

  const [patterns, setPatterns] = useState<Pattern[]>([])
  const [screens, setScreens] = useState<Screen[]>([])
  const [draftScreenOrigin, setDraftScreenOrigin] = useState<Point | undefined>(undefined)

  const ctx = useMemo(() => canvasEl?.getContext('2d'), [canvasEl])

  // Handle viewport size changes
  useEffect(() => {
    if (!canvasEl) return

    const handleResize = (): void => {
      const { width, height } = canvasEl.getBoundingClientRect()
      canvasEl.width = width
      canvasEl.height = height
    }

    handleResize()

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [canvasEl])

  // Handle keyboard commands
  useEffect(() => {
    const handleKeyDown = (keydownEvent: KeyboardEvent) => {
      if (keydownEvent.key === 'Escape') {
        setScreens([])
        setPatterns([])
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  // Render
  useEffect(() => {
    if (!ctx) return

    let cancelled = false

    const render = (): void => {
      if (cancelled) return

      // todo: is this a top-level screen, or are we creating a new pattern?
      //  for now we'll always handle drafts as a top-level screen until submitted.
      const draftScreen =
        draftScreenOrigin !== undefined
          ? getScreenFromTwoPoints(draftScreenOrigin, mousePositionRef.current)
          : undefined

      drawFrame(ctx, screens, draftScreen, patterns)

      requestAnimationFrame(render)
    }

    requestAnimationFrame(render)

    return () => {
      cancelled = true
    }
  }, [ctx, draftScreenOrigin, screens, patterns])

  return (
    <StyledCanvas
      ref={setCanvasEl}
      onMouseDown={e => {
        if (!ctx) return

        const mousePoint = getMousePoint(ctx, e)

        // create draft screen based on current cursor position
        setDraftScreenOrigin(mousePoint)
      }}
      onMouseUp={e => {
        if (!ctx) return
        if (!draftScreenOrigin) return

        // reset origin. note: this is async so we can still use the value below.
        setDraftScreenOrigin(undefined)

        const mousePoint = getMousePoint(ctx, e)

        const [x1, y1] = draftScreenOrigin
        const [x2, y2] = mousePoint

        // validate size, ignore drawings that are too small (arbitrary)
        // todo: convert to viewport size and check pixels
        if (Math.abs(x2 - x1) < 0.01) return
        if (Math.abs(y2 - y1) < 0.01) return

        const res = findClickedScreenOrPattern(screens, patterns, draftScreenOrigin)

        console.log(res)
        // if draft origin is inside existing screen, add a pattern instead
        if (res !== undefined) {
          setPatterns(prev => {
            const [screenIndex, outerPatternIndex, ...patternPath] = res

            if (screenIndex === undefined) {
              throw new Error('path cannot be zero length')
            }

            const outerScreenBoundaries = getScreenBoundaries(screens[screenIndex])

            let anchor = getRelativePointPosition(draftScreenOrigin, outerScreenBoundaries)
            let target = getRelativePointPosition(mousePoint, outerScreenBoundaries)

            // This needs to be a special case because the model isn't so good
            if (outerPatternIndex === undefined) {
              return [
                ...prev,
                {
                  anchor,
                  target,
                  subpatterns: [],
                },
              ]
            }

            // hacky deep clone
            const newPatterns = JSON.parse(JSON.stringify(prev))

            let pattern = newPatterns[outerPatternIndex]

            // ...
            const initialBoundaries = getBoundariesFromTwoPoints(pattern.anchor, pattern.target)
            anchor = getRelativePointPosition(anchor, initialBoundaries)
            target = getRelativePointPosition(target, initialBoundaries)

            for (const k of patternPath) {
              pattern = newPatterns[k]

              const boundaries = getBoundariesFromTwoPoints(pattern.anchor, pattern.target)
              anchor = getRelativePointPosition(anchor, boundaries)
              target = getRelativePointPosition(target, boundaries)
            }

            pattern.subpatterns.push({
              anchor,
              target,
              subpatterns: [],
            })

            return newPatterns
          })
        } else {
          // else, create top-level screen
          const newScreen = getScreenFromTwoPoints(draftScreenOrigin, mousePoint)
          setScreens(prev => [...prev, newScreen])
        }
      }}
      onMouseMove={e => {
        if (!ctx) return

        mousePositionRef.current = getMousePoint(ctx, e)
      }}
    />
  )
}

export default App
