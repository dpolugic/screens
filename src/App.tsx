import { useEffect, useMemo, useReducer, useRef, useState } from 'react'

import { drawFrameIncrementally, drawFramePreview } from './draw/draw-frame'
import {
  applyMatrixAndOffsetToRectangle,
  ClickedPath,
  combineTransformations,
  findClickedScreenOrPattern,
  getMatrixAndOffsetFromRectangle,
  getMousePoint,
  getRelativePatternPosition,
  randomId,
} from './functions'
import { useStableFunction } from './hooks'
import { Preview } from './preview'
import {
  AbsolutePattern,
  AbsolutePoint,
  NumberPair,
  PatternId,
  RelativePattern,
  State,
  Transformation,
} from './types'

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

  let transform: Transformation = getMatrixAndOffsetFromRectangle(state.screens[screenIndex]!)

  for (const k of nestedPath) {
    transform = combineTransformations(
      transform.matrix,
      transform.offset,
      state.patterns[k]!.matrix,
      state.patterns[k]!.offset
    )
  }

  const newDraft = getMatrixAndOffsetFromRectangle(
    getRelativePatternPosition(
      draftPatternRelative,
      applyMatrixAndOffsetToRectangle(transform.matrix, transform.offset, {
        anchor: [0, 0],
        target: [1, 1],
      } as AbsolutePattern)
    )
  )

  return {
    ...state,
    patterns: state.patterns.concat({
      id: randomId() as PatternId,
      matrix: newDraft.matrix,
      offset: newDraft.offset,
    }),
  }
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

const BASE_MOUSE_POSITION = [0, 0] satisfies NumberPair as AbsolutePoint

const BASE_STATE = {
  screens: [],
  patterns: [],
}

const PreviewButton: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({
  onClick,
  children,
}) => {
  return (
    <button
      className='text-amber-300 hover:text-black cursor-pointer p-2 hover:bg-amber-300 font-mono'
      type='button'
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function App() {
  const [previewOpen, setPreviewOpen] = useState(false)
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

    const observer = new ResizeObserver(handleResize)

    observer.observe(canvasEl)

    return () => {
      observer.disconnect()
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
    <div className='size-full flex'>
      {previewOpen ? (
        <div className='flex-1/3 border-r-amber-300 border-r-1'>
          <div className='flex gap-2 items-center justify-between pr-2 border-b-amber-300 border-b-1'>
            <PreviewButton onClick={() => setPreviewOpen(false)}>x</PreviewButton>
            <h2 className='text-amber-300'>preview (wip)</h2>
          </div>
          <Preview
            state={state}
            updatePattern={(id, pattern) => {
              const prev = state.patterns.find(p => p.id === id)

              if (!prev) {
                throw new Error(`Pattern with id ${id} not found`)
              }

              const { matrix, offset } = getMatrixAndOffsetFromRectangle(pattern)

              setState(prevState => ({
                ...prevState,
                patterns: prevState.patterns.map((p): State['patterns'][number] =>
                  p.id === id ? { ...p, matrix, offset } : p
                ),
              }))
            }}
          />
        </div>
      ) : (
        <div className=' border-r-amber-300 border-r-1'>
          <PreviewButton onClick={() => setPreviewOpen(true)}>&gt;</PreviewButton>
        </div>
      )}
      <div className='flex-2/3'>
        <canvas
          className='size-full'
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
      </div>
    </div>
  )
}

export default App
