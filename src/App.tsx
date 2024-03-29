import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

import styled, { createGlobalStyle } from 'styled-components'

const StyledCanvas = styled.canvas`
  /* border: 1px solid #faf; */
  width: 100%;
  height: 100%;
`

const BodyStyle = createGlobalStyle`
  html, body, #root {
    width: 100vw;
    height: 100vh;
    margin: 0;
    padding: 0;
  }

  *, *::before, *::after {
    box-sizing: border-box !important; 
  }
`

type Point = [number, number]

type Size = [number, number]

type Screen = {
  topLeft: Point
  topRight: Point
  bottomLeft: Point
  bottomRight: Point
}

const getScreenFromTwoPoints = ([x1, y1]: Point, [x2, y2]: Point): Screen => {
  const xMin = Math.min(x1, x2)
  const xMax = Math.max(x1, x2)
  const yMin = Math.min(y1, y2)
  const yMax = Math.max(y1, y2)

  return {
    topLeft: [xMin, yMin],
    topRight: [xMax, yMin],
    bottomLeft: [xMin, yMax],
    bottomRight: [xMax, yMax],
  }
}

const mapPointToScreenSpace = ([x, y]: Point, [screenSizeX, screenSizeY]: Size): Point => {
  return [x * screenSizeX, y * screenSizeY]
}

const mapPointFromScreenSpace = ([x, y]: Point, [screenSizeX, screenSizeY]: Size): Point => {
  return [x / screenSizeX, y / screenSizeY]
}

const drawScreen = (ctx: CanvasRenderingContext2D, screen: Screen): void => {
  const { topLeft, topRight, bottomLeft, bottomRight } = screen

  const screenSize: Size = [ctx.canvas.width, ctx.canvas.height]

  ctx.beginPath()
  ctx.moveTo(...mapPointToScreenSpace(topLeft, screenSize))
  ctx.lineTo(...mapPointToScreenSpace(topRight, screenSize))
  ctx.lineTo(...mapPointToScreenSpace(bottomRight, screenSize))
  ctx.lineTo(...mapPointToScreenSpace(bottomLeft, screenSize))
  ctx.lineTo(...mapPointToScreenSpace(topLeft, screenSize))

  ctx.lineWidth = 2
  ctx.strokeStyle = '#faf'
  ctx.stroke()
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mousePositionRef = useRef<Point>([0, 0])

  const [screens, setScreens] = useState<Screen[]>([])
  const [draftScreenOrigin, setDraftScreenOrigin] = useState<Point | undefined>(undefined)

  const ctx = useMemo(() => {
    const el = canvasRef.current

    if (!el) return undefined

    const context = el.getContext('2d')

    if (!context) {
      throw new Error('2d context not supported')
    }

    const { width, height } = el.getBoundingClientRect()
    el.width = width
    el.height = height

    return context
  }, [])

  const getMousePoint = useCallback(
    (mouseEvent: React.MouseEvent<HTMLCanvasElement, MouseEvent>) => {
      const screenSize: Size = [ctx?.canvas.width ?? 1, ctx?.canvas.height ?? 1]
      return mapPointFromScreenSpace([mouseEvent.clientX, mouseEvent.clientY], screenSize)
    },
    [ctx]
  )

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

    const drawFrame = (): void => {
      if (cancelled) return

      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)

      for (const screen of screens) {
        drawScreen(ctx, screen)
      }

      if (draftScreenOrigin) {
        const p0 = draftScreenOrigin
        const p1 = mousePositionRef.current

        drawScreen(ctx, getScreenFromTwoPoints(p0, p1))
      }
      requestAnimationFrame(drawFrame)
    }

    requestAnimationFrame(drawFrame)

    return () => {
      cancelled = true
    }
  }, [ctx, draftScreenOrigin, screens])

  return (
    <React.Fragment>
      <BodyStyle />
      <StyledCanvas
        ref={canvasRef}
        onMouseDown={e => {
          const mousePoint = getMousePoint(e)
          // create draft screen based on current cursor position
          setDraftScreenOrigin(mousePoint)
        }}
        onMouseUp={e => {
          if (!draftScreenOrigin) return

          const mousePoint = getMousePoint(e)

          // convert draft screen to real screen
          setScreens(prev => [...prev, getScreenFromTwoPoints(draftScreenOrigin, mousePoint)])

          // reset draft screen
          setDraftScreenOrigin(undefined)
        }}
        onMouseMove={e => {
          mousePositionRef.current = getMousePoint(e)
        }}
      ></StyledCanvas>
    </React.Fragment>
  )
}

export default App
