import { useEffect, useMemo, useRef, useState } from 'react'

import styled from 'styled-components'
import { drawFrame } from './draw'
import { getMousePoint, getScreenBoundaries, getScreenFromTwoPoints } from './functions'
import { Point, Screen } from './types'

const StyledCanvas = styled.canvas`
  /* border: 1px solid #faf; */
  display: block;
  width: 100%;
  height: 100%;
`

function App() {
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null)
  const mousePositionRef = useRef<Point>([0, 0])

  const [screens, setScreens] = useState<Screen[]>([])
  const [draftScreenOrigin, setDraftScreenOrigin] = useState<Point | undefined>(undefined)

  const ctx = useMemo(() => {
    if (!canvasEl) return undefined

    const context = canvasEl.getContext('2d')

    if (!context) {
      throw new Error('2d context not supported')
    }

    const { width, height } = canvasEl.getBoundingClientRect()
    canvasEl.width = width
    canvasEl.height = height

    return context
  }, [canvasEl])

  useEffect(() => {
    const handleKeyDown = (keydownEvent: KeyboardEvent) => {
      if (keydownEvent.key === 'Escape') {
        setScreens([])
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  useEffect(() => {
    if (!ctx) return

    let cancelled = false

    const render = (): void => {
      if (cancelled) return

      const draftScreen =
        draftScreenOrigin !== undefined
          ? getScreenFromTwoPoints(draftScreenOrigin, mousePositionRef.current)
          : undefined

      drawFrame(ctx, screens, draftScreen)

      requestAnimationFrame(render)
    }

    requestAnimationFrame(render)

    return () => {
      cancelled = true
    }
  }, [ctx, draftScreenOrigin, screens])

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

        // reset draft screen
        setDraftScreenOrigin(undefined)

        const mousePoint = getMousePoint(ctx, e)

        // convert draft screen to real screen
        const newScreen = getScreenFromTwoPoints(draftScreenOrigin, mousePoint)

        // validate size, ignore screens that are too small (arbitrary)
        // todo: convert to viewport size and checks pixels
        const { xMin, yMin, xMax, yMax } = getScreenBoundaries(newScreen)
        if (xMax - xMin < 0.01 || yMax - yMin < 0.01) return

        setScreens(prev => [...prev, newScreen])
      }}
      onMouseMove={e => {
        if (!ctx) return

        mousePositionRef.current = getMousePoint(ctx, e)
      }}
    />
  )
}

export default App
