import React, { useEffect, useMemo, useRef, useState } from 'react'

import styled from 'styled-components'

const StyledCanvas = styled.canvas`
  /* border: 1px solid #faf; */
  width: 100%;
  height: 100%;
`

type Point = [x: number, y: number]

type Line = [startPoint: Point, endPoint: Point]

type Size = [width: number, height: number]

type Screen = {
  topLeft: Point
  topRight: Point
  bottomLeft: Point
  bottomRight: Point
}

type Boundaries = {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
}

type ScreenOverlap =
  | {
      type: 'lines'
      lines: Line[]
    }
  | {
      type: 'screen'
      screen: Screen
    }
  | {
      type: 'partial'
      screen: Screen
      crop: Boundaries
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

const getScreenBoundaries = (screen: Screen): Boundaries => {
  const { topLeft, bottomRight } = screen
  const [xMin, yMin] = topLeft
  const [xMax, yMax] = bottomRight

  return { xMin, xMax, yMin, yMax }
}

const pointIsInsideScreen = (point: Point, screen: Screen): boolean => {
  const { xMin, xMax, yMin, yMax } = getScreenBoundaries(screen)
  const [pointX, pointY] = point

  return xMin <= pointX && pointX <= xMax && yMin <= pointY && pointY <= yMax
}

const getScreenAsLines = (screen: Screen): [Line, Line, Line, Line] => {
  const { topLeft, topRight, bottomLeft, bottomRight } = screen
  return [
    [topLeft, topRight],
    [topRight, bottomRight],
    [bottomRight, bottomLeft],
    [bottomLeft, topLeft],
  ]
}

const lineIsInsideScreen = (line: Line, screen: Screen): boolean => {
  // Note: This only checks if the entire line is in the screen
  return pointIsInsideScreen(line[0], screen) && pointIsInsideScreen(line[1], screen)
}

const mapPointToScreenSpace = ([x, y]: Point, [screenSizeX, screenSizeY]: Size): Point => {
  return [x * screenSizeX, y * screenSizeY]
}

const mapPointFromScreenSpace = ([x, y]: Point, [screenSizeX, screenSizeY]: Size): Point => {
  return [x / screenSizeX, y / screenSizeY]
}

const getScreenOverlap = (screen: Screen, overlapping: Screen): ScreenOverlap => {
  const isScreenInScreen =
    pointIsInsideScreen(overlapping.topLeft, screen) &&
    pointIsInsideScreen(overlapping.topRight, screen) &&
    pointIsInsideScreen(overlapping.bottomRight, screen) &&
    pointIsInsideScreen(overlapping.bottomLeft, screen)

  if (isScreenInScreen) {
    return {
      type: 'screen',
      screen: {
        topLeft: mapPointBetweenScreens(overlapping.topLeft, screen, overlapping),
        topRight: mapPointBetweenScreens(overlapping.topRight, screen, overlapping),
        bottomRight: mapPointBetweenScreens(overlapping.bottomRight, screen, overlapping),
        bottomLeft: mapPointBetweenScreens(overlapping.bottomLeft, screen, overlapping),
      },
    }
  } else {
    return {
      type: 'lines',
      lines: getScreenAsLines(overlapping).filter(it => lineIsInsideScreen(it, screen)),
    }
  }
}

const getRelativePointPosition = (point: Point, screen: Screen): Point => {
  const { xMin, xMax, yMin, yMax } = getScreenBoundaries(screen)
  const [x, y] = point

  const relativeX = (x - xMin) / (xMax - xMin)
  const relativeY = (y - yMin) / (yMax - yMin)

  return [relativeX, relativeY]
}

const resolveRelativePointPosition = (relativePoint: Point, screen: Screen): Point => {
  const { xMin, xMax, yMin, yMax } = getScreenBoundaries(screen)
  const [x, y] = relativePoint

  const resolvedX = xMin + x * (xMax - xMin)
  const resolvedY = yMin + y * (yMax - yMin)

  return [resolvedX, resolvedY]
}

const mapPointBetweenScreens = (point: Point, fromScreen: Screen, toScreen: Screen): Point => {
  const relativePoint = getRelativePointPosition(point, fromScreen)

  return resolveRelativePointPosition(relativePoint, toScreen)
}

const drawLine = (ctx: CanvasRenderingContext2D, line: Line, strokeStyle: string): void => {
  const [startPoint, endPoint] = line

  const screenSize: Size = [ctx.canvas.width, ctx.canvas.height]

  ctx.lineWidth = 2
  ctx.strokeStyle = strokeStyle

  ctx.beginPath()
  ctx.moveTo(...mapPointToScreenSpace(startPoint, screenSize))
  ctx.lineTo(...mapPointToScreenSpace(endPoint, screenSize))
  ctx.stroke()
}

const drawScreen = (ctx: CanvasRenderingContext2D, screen: Screen): void => {
  const { topLeft, topRight, bottomLeft, bottomRight } = screen

  const screenSize: Size = [ctx.canvas.width, ctx.canvas.height]

  ctx.lineWidth = 2
  ctx.strokeStyle = '#faf'

  ctx.beginPath()
  ctx.moveTo(...mapPointToScreenSpace(topLeft, screenSize))
  ctx.lineTo(...mapPointToScreenSpace(topRight, screenSize))
  ctx.lineTo(...mapPointToScreenSpace(bottomRight, screenSize))
  ctx.lineTo(...mapPointToScreenSpace(bottomLeft, screenSize))
  ctx.closePath()

  ctx.stroke()
}

const getLinesFromOverlap = (overlap: ScreenOverlap): Line[] => {
  switch (overlap.type) {
    case 'lines':
      return overlap.lines
    case 'screen':
      return getScreenAsLines(overlap.screen)
    case 'partial':
      throw new Error('not implemented')
  }
}

const drawScreenOverlap = (
  ctx: CanvasRenderingContext2D,
  overlap: ScreenOverlap,
  strokeStyle: string
): void => {
  const lines = getLinesFromOverlap(overlap)
  for (const line of lines) {
    drawLine(ctx, line, strokeStyle)
  }
}

const getMousePoint = (
  ctx: CanvasRenderingContext2D,
  mouseEvent: React.MouseEvent<HTMLCanvasElement, MouseEvent>
) => {
  const screenSize: Size = [ctx.canvas.width, ctx.canvas.height]
  return mapPointFromScreenSpace([mouseEvent.clientX, mouseEvent.clientY], screenSize)
}

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

    const drawFrame = (): void => {
      if (cancelled) return

      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)

      for (const screen of screens) {
        drawScreen(ctx, screen)
      }

      const draftScreen =
        draftScreenOrigin !== undefined
          ? getScreenFromTwoPoints(draftScreenOrigin, mousePositionRef.current)
          : undefined

      if (draftScreen) {
        drawScreen(ctx, draftScreen)
      }

      const screensWithDraft = draftScreen !== undefined ? screens.concat(draftScreen) : screens
      const generatedScreens: Screen[] = []

      for (let k = 0; k < 3; k++) {
        const color = ['#f00a', '#0f0a', '#00fa', '#fafa'][k]
        const allScreens = [...screensWithDraft, ...generatedScreens]
        for (let i = 0; i < allScreens.length; i++) {
          const screen1 = allScreens[i]
          for (let j = i + 1; j < allScreens.length; j++) {
            const screen2 = allScreens[j]

            // todo: wrong!
            const overlap = getScreenOverlap(screen1, screen2)

            if (overlap.type === 'screen') {
              const asdf = JSON.stringify(overlap.screen)

              // make sure screen isn't already in list
              if (!generatedScreens.some(x => JSON.stringify(x) === asdf)) {
                generatedScreens.push(overlap.screen)
              }
            }

            drawScreenOverlap(ctx, overlap, color)
          }
        }
      }

      requestAnimationFrame(drawFrame)
    }

    requestAnimationFrame(drawFrame)

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
