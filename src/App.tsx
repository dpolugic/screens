import { useEffect, useMemo, useRef, useState } from 'react'

import styled from 'styled-components'
import { drawFrame } from './draw'
import {
  ClickedPath,
  findClickedScreenOrPattern,
  getMousePoint,
  getRelativePatternPosition,
} from './functions'
import { AbsolutePoint, State, asAbsolutePoint } from './types'

const StyledCanvas = styled.canvas`
  /* border: 1px solid #faf; */
  display: block;
  width: 100%;
  height: 100%;
`

const getDraftState = (
  state: State,
  draftClick: DraftClick | undefined,
  mousePosition: AbsolutePoint
): State => {
  if (draftClick === undefined) return state

  const draftPattern = {
    anchor: draftClick.anchor,
    target: mousePosition,
  }

  if (draftClick.clickedPath === undefined) {
    // create top-level screen
    return { ...state, screens: state.screens.concat(draftPattern) }
  }

  // if draft origin is inside existing screen, add a pattern instead
  const { screenIndex, nestedPath } = draftClick.clickedPath

  let newDraft = getRelativePatternPosition(draftPattern, state.screens[screenIndex])
  for (const k of nestedPath) {
    newDraft = getRelativePatternPosition(newDraft, state.patterns[k])
  }

  return { ...state, patterns: state.patterns.concat(newDraft) }
}

type DraftClick = {
  anchor: AbsolutePoint
  clickedPath: ClickedPath | undefined
}

const BASE_MOUSE_POSITION = asAbsolutePoint([0, 0])

const BASE_STATE = {
  screens: [],
  patterns: [],
}

function App() {
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null)
  const mousePositionRef = useRef<AbsolutePoint>(BASE_MOUSE_POSITION)

  const [state, setState] = useState<State>(BASE_STATE)
  const [draftClick, setDraftClick] = useState<DraftClick | undefined>(undefined)

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
        setState(BASE_STATE)
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

      const draftState = getDraftState(state, draftClick, mousePositionRef.current)

      drawFrame(ctx, draftState)

      requestAnimationFrame(render)
    }

    requestAnimationFrame(render)

    return () => {
      cancelled = true
    }
  }, [ctx, draftClick, state])

  return (
    <StyledCanvas
      ref={setCanvasEl}
      onMouseDown={e => {
        if (!ctx) return

        const mousePoint = getMousePoint(ctx, e)

        // create draft screen based on current cursor position
        setDraftClick({
          anchor: mousePoint,
          clickedPath: findClickedScreenOrPattern(state, mousePoint),
        })
      }}
      onMouseUp={e => {
        if (!ctx) return
        if (!draftClick) return

        // reset origin. note: this is async so we can still use the value below.
        setDraftClick(undefined)

        const mousePoint = getMousePoint(ctx, e)

        const [x1, y1] = draftClick.anchor
        const [x2, y2] = mousePoint

        // validate size, ignore drawings that are too small (arbitrary)
        // todo: convert to viewport size and check pixels
        if (Math.abs(x2 - x1) < 0.01) return
        if (Math.abs(y2 - y1) < 0.01) return

        setState(prevState => getDraftState(prevState, draftClick, mousePoint))
      }}
      onMouseMove={e => {
        if (!ctx) return

        mousePositionRef.current = getMousePoint(ctx, e)
      }}
    />
  )
}

export default App
