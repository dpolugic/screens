import { useEffect, useMemo, useReducer, useRef, useState } from 'react'

import styled from 'styled-components'
import { drawFrameIncrementally, drawFramePreview } from './draw/draw-frame'
import {
  ClickedPath,
  findClickedScreenOrPattern,
  getMousePoint,
  getRelativePatternPosition,
} from './functions'
import { useStableFunction } from './hooks'
import { AbsolutePattern, AbsolutePoint, RelativePattern, State, asAbsolutePoint } from './types'

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

  // Re-interpret as relative pattern.
  const draftPatternRelative = draftPattern satisfies AbsolutePattern as unknown as RelativePattern

  let newDraft = getRelativePatternPosition(draftPatternRelative, state.screens[screenIndex]!)
  for (const k of nestedPath) {
    newDraft = getRelativePatternPosition(newDraft, state.patterns[k]!)
  }

  return { ...state, patterns: state.patterns.concat(newDraft) }
}

type DraftClick = {
  anchor: AbsolutePoint
  clickedPath: ClickedPath | undefined
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

  // The canvas contents are cleared when we change its size. Make sure to re-render when this
  // variable changes.
  const [resizeCount, incrementResizeCount] = useReducer(x => x + 1, 0)

  const [state, setState] = useState<State>(BASE_STATE)
  const [draftClick, setDraftClick] = useState<DraftClick | undefined>(undefined)

  const ctx = useMemo(() => canvasEl?.getContext('2d', { alpha: false }), [canvasEl])

  // Handle viewport size changes
  useEffect(() => {
    if (!canvasEl) return

    const handleResize = () => {
      const { width, height } = canvasEl.getBoundingClientRect()
      canvasEl.width = width
      canvasEl.height = height

      incrementResizeCount()
    }

    handleResize()

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [canvasEl])

  // Handle keyboard commands
  useOnKeydown(event => {
    if (event.key === 'Escape') {
      setState(BASE_STATE)
      setDraftClick(undefined)
    }
  })

  useEffect(() => {
    if (!ctx) return

    if (draftClick !== undefined) {
      // Render preview

      let cancelled = false
      const renderLoop = () => {
        if (cancelled) return
        const draftState = getDraftState(state, draftClick, mousePositionRef.current)

        drawFramePreview(ctx, draftState)

        requestAnimationFrame(renderLoop)
      }

      renderLoop()

      return () => {
        cancelled = true
      }
    } else {
      const generator = drawFrameIncrementally(ctx, state)

      let cancelled = false
      const renderLoop = () => {
        if (cancelled) return

        const res = generator.next()
        if (!res.done) {
          requestAnimationFrame(renderLoop)
        }
      }

      renderLoop()

      return () => {
        cancelled = true
        generator.return()
      }
    }
  }, [draftClick, state, resizeCount, ctx])

  return (
    <StyledCanvas
      ref={setCanvasEl}
      onPointerDown={e => {
        if (!ctx) return

        const mousePoint = getMousePoint(ctx, e)

        // create draft screen based on current cursor position
        setDraftClick({
          anchor: mousePoint,
          clickedPath: findClickedScreenOrPattern(state, mousePoint),
        })
      }}
      onPointerUp={e => {
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
      onPointerMove={e => {
        if (!ctx) return

        mousePositionRef.current = getMousePoint(ctx, e)
      }}
    />
  )
}

export default App
