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

const getDraftState = (
  screens: Screen[],
  patterns: Pattern[],
  draft:
    | {
        anchor: Point
        target: Point
      }
    | undefined
): {
  screens: Screen[]
  patterns: Pattern[]
} => {
  if (draft === undefined) return { screens, patterns }

  const res = findClickedScreenOrPattern(screens, patterns, draft.anchor)

  // if draft origin is inside existing screen, add a pattern instead
  if (res !== undefined) {
    const [screenIndex, outerPatternIndex, ...patternPath] = res

    if (screenIndex === undefined) {
      throw new Error('path cannot be zero length')
    }

    const outerScreenBoundaries = getScreenBoundaries(screens[screenIndex])

    let anchor = getRelativePointPosition(draft.anchor, outerScreenBoundaries)
    let target = getRelativePointPosition(draft.target, outerScreenBoundaries)

    // This needs to be a special case because the model isn't so good
    if (outerPatternIndex === undefined) {
      return {
        screens,
        patterns: [
          ...patterns,
          {
            anchor,
            target,
            subpatterns: [],
          },
        ],
      }
    }

    // hacky deep clone
    const newPatterns = JSON.parse(JSON.stringify(patterns))

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

    return { screens, patterns: newPatterns }
  } else {
    // else, create top-level screen
    const newScreen = getScreenFromTwoPoints(draft.anchor, draft.target)
    const newScreens = [...screens, newScreen]

    return { screens: newScreens, patterns }
  }
}

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

      const { screens: draftScreens, patterns: draftPatterns } = getDraftState(
        screens,
        patterns,
        draftScreenOrigin !== undefined
          ? {
              anchor: draftScreenOrigin,
              target: mousePositionRef.current,
            }
          : undefined
      )

      drawFrame(ctx, draftScreens, draftPatterns)

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

        const { screens: draftScreens, patterns: draftPatterns } = getDraftState(screens, patterns, {
          anchor: draftScreenOrigin,
          target: mousePositionRef.current,
        })

        setScreens(draftScreens)
        setPatterns(draftPatterns)
      }}
      onMouseMove={e => {
        if (!ctx) return

        mousePositionRef.current = getMousePoint(ctx, e)
      }}
    />
  )
}

export default App
