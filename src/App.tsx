import React, { useCallback, useEffect, useRef, useState } from 'react'
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

const drawScreen = (ctx: CanvasRenderingContext2D, screen: Screen): void => {
  const { topLeft, topRight, bottomLeft, bottomRight } = screen

  ctx.beginPath()
  ctx.moveTo(...topLeft)
  ctx.lineTo(...topRight)
  ctx.lineTo(...bottomRight)
  ctx.lineTo(...bottomLeft)
  ctx.lineTo(...topLeft)

  ctx.lineWidth = 2
  ctx.strokeStyle = '#faf'
  ctx.stroke()
}

const INITIAL_SCREENS = [getScreenFromTwoPoints([100, 150], [200, 300])]

function App() {
  const [screens, setScreens] = useState<Screen[]>(INITIAL_SCREENS)
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | undefined>(undefined)

  const mousePositionRef = useRef<Point>([0, 0])

  const [draftScreenOrigin, setDraftScreenOrigin] = useState<Point | undefined>(undefined)

  const canvasCallback = useCallback((el: HTMLCanvasElement) => {
    const ctx = el.getContext('2d')

    if (!ctx) {
      throw new Error('2d context not supported')
    }

    const { width, height } = el.getBoundingClientRect()
    el.width = width
    el.height = height

    setCtx(ctx)
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
        ref={canvasCallback}
        onMouseDown={e => {
          const { clientX, clientY } = e
          // create draft screen based on current cursor position
          setDraftScreenOrigin([clientX, clientY])
        }}
        onMouseUp={e => {
          if (!draftScreenOrigin) return

          // convert draft screen to real screen
          setScreens(prev => [...prev, getScreenFromTwoPoints(draftScreenOrigin, [e.clientX, e.clientY])])

          // reset draft screen
          setDraftScreenOrigin(undefined)
        }}
        onMouseMove={e => {
          mousePositionRef.current = [e.clientX, e.clientY]
        }}
      ></StyledCanvas>
    </React.Fragment>
  )
}

export default App
