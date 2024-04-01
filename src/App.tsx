import { useEffect, useMemo, useRef, useState } from 'react'

import styled from 'styled-components'
import { drawFrame } from './draw'
import {
  ClickedPath,
  findClickedScreenOrPattern,
  getBoundariesFromPattern,
  getMousePoint,
  getRelativePatternPosition,
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
  clickOriginResult: ClickedPath | undefined,
  draftPattern:
    | {
        anchor: Point
        target: Point
      }
    | undefined
): {
  screens: Screen[]
  patterns: Pattern[]
} => {
  if (draftPattern === undefined) return { screens, patterns }

  // if draft origin is inside existing screen, add a pattern instead
  if (clickOriginResult !== undefined) {
    const { screenIndex, nestedPath } = clickOriginResult

    const [outerPatternIndex, ...otherPath] = nestedPath

    const outerScreenBoundaries = getScreenBoundaries(screens[screenIndex])

    let newDraft = getRelativePatternPosition(draftPattern, outerScreenBoundaries)

    if (outerPatternIndex === undefined) {
      return {
        screens,
        patterns: patterns.concat(newDraft),
      }
    }

    let pattern = patterns[outerPatternIndex]

    // ...
    const initialBoundaries = getBoundariesFromPattern(pattern)
    newDraft = getRelativePatternPosition(newDraft, initialBoundaries)

    for (const k of otherPath) {
      pattern = patterns[k]

      const boundaries = getBoundariesFromPattern(pattern)
      newDraft = getRelativePatternPosition(newDraft, boundaries)
    }

    return { screens, patterns: patterns.concat(newDraft) }
  } else {
    // else, create top-level screen
    const newScreen = getScreenFromTwoPoints(draftPattern.anchor, draftPattern.target)

    return { screens: screens.concat(newScreen), patterns }
  }
}

function App() {
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null)
  const mousePositionRef = useRef<Point>([0, 0])

  const [patterns, setPatterns] = useState<Pattern[]>([])
  const [screens, setScreens] = useState<Screen[]>([])
  const [draftScreenOrigin, setDraftScreenOrigin] = useState<Point | undefined>(undefined)

  const draftClickResult = useMemo(() => {
    if (draftScreenOrigin === undefined) return undefined

    return findClickedScreenOrPattern(screens, patterns, draftScreenOrigin)
  }, [draftScreenOrigin, patterns, screens])

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
        draftClickResult,
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

        const { screens: draftScreens, patterns: draftPatterns } = getDraftState(
          screens,
          patterns,
          draftClickResult,
          {
            anchor: draftScreenOrigin,
            target: mousePositionRef.current,
          }
        )

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
