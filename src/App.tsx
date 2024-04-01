import { useEffect, useMemo, useRef, useState } from 'react'

import styled from 'styled-components'
import { RenderOptions, drawFrame } from './draw'
import {
  ClickedPath,
  findClickedScreenOrPattern,
  getMousePoint,
  getRelativePatternPosition,
} from './functions'
import { useStableFunction } from './hooks'
import { AbsolutePoint, State, asAbsolutePoint } from './types'

const StyledCanvas = styled.canvas`
  /* border: 1px solid #faf; */
  display: block;
  width: 100%;
  height: 100%;
`

const getDraftState = (state: State, draftClick: DraftClick, mousePosition: AbsolutePoint): State => {
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

const useHandleResize = (canvasEl: HTMLCanvasElement | null): void => {
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
}

const useOnKeydown = (f: (e: KeyboardEvent) => void) => {
  const stableCallback = useStableFunction(f)

  useEffect(() => {
    document.addEventListener('keydown', stableCallback)

    return () => {
      document.removeEventListener('keydown', stableCallback)
    }
  }, [stableCallback])
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
  useHandleResize(canvasEl)

  // Handle keyboard commands
  useOnKeydown(event => {
    if (event.key === 'Escape') {
      setState(BASE_STATE)
      setDraftClick(undefined)
    }
  })

  const render = useStableFunction((renderState: State, renderOptions: RenderOptions) => {
    if (!ctx) return

    drawFrame(ctx, renderState, renderOptions)
  })

  useEffect(() => {
    if (draftClick !== undefined) return

    let cancelled = false
    const renderLoop = () => {
      if (cancelled) return
      render(state, { reset: false })

      requestAnimationFrame(renderLoop)
    }

    render(state, { reset: true })

    requestAnimationFrame(renderLoop)

    return () => {
      cancelled = true
    }
  }, [draftClick, render, state])

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

        if (draftClick !== undefined) {
          const draftState = getDraftState(state, draftClick, mousePositionRef.current)

          render(draftState, { reset: true })
        }
      }}
    />
  )
}

export default App
