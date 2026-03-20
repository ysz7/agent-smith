import { useCallback, useEffect, useRef, useState } from 'react'

export type AvatarMode  = 'header' | 'background'
export type ResizeDir   = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

const LS_KEY   = 'agent-smith:floating-avatar'
const MIN_SIZE = 100
const MAX_SIZE = 500

interface Stored {
  mode: AvatarMode
  x: number | null
  y: number
  size: number
}

function readStorage(): Stored {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) throw new Error('empty')
    const v = JSON.parse(raw) as Partial<Stored>
    return {
      mode: v.mode === 'background' ? 'background' : 'header',
      x:    typeof v.x === 'number' ? v.x : null,
      y:    typeof v.y === 'number' ? v.y : 0,
      size: typeof v.size === 'number' ? Math.min(MAX_SIZE, Math.max(MIN_SIZE, v.size)) : 240,
    }
  } catch {
    return { mode: 'header', x: null, y: 0, size: 240 }
  }
}

function clampPos(
  x: number, y: number, size: number,
  containerW: number, containerH: number,
): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(containerW - size, x)),
    y: Math.max(0, Math.min(containerH - size, y)),
  }
}

export function useFloatingAvatar(containerRef: React.RefObject<HTMLDivElement>) {
  const initial = readStorage()

  const [mode, setModeState] = useState<AvatarMode>(initial.mode)
  const [x,    setX]         = useState<number | null>(initial.x)
  const [y,    setY]         = useState<number>(initial.y)
  const [size, setSize]      = useState<number>(initial.size)

  // Refs so window-level pointer handlers always see latest values
  const xRef    = useRef<number>(initial.x ?? 0)
  const yRef    = useRef<number>(initial.y)
  const sizeRef = useRef<number>(initial.size)

  useEffect(() => { if (x !== null) xRef.current = x }, [x])
  useEffect(() => { yRef.current = y }, [y])
  useEffect(() => { sizeRef.current = size }, [size])

  // ── Persist ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (x === null) return
    localStorage.setItem(LS_KEY, JSON.stringify({ mode, x, y, size }))
  }, [mode, x, y, size])

  // ── setMode ────────────────────────────────────────────────────────────────
  const setMode = useCallback((m: AvatarMode | ((prev: AvatarMode) => AvatarMode)) => {
    setModeState(m)
  }, [])

  // ── Initialize x once container is known ──────────────────────────────────
  const initialized = useRef(initial.x !== null)

  const initPosition = useCallback((containerW: number) => {
    if (initialized.current) return
    initialized.current = true
    const initX = Math.max(0, Math.round((containerW - sizeRef.current) / 2))
    xRef.current = initX
    setX(initX)
  }, [])

  // ── Re-clamp on container resize ──────────────────────────────────────────
  const reclamp = useCallback(() => {
    const el = containerRef.current
    if (!el || x === null) return
    const clamped = clampPos(xRef.current, yRef.current, sizeRef.current, el.offsetWidth, el.offsetHeight)
    xRef.current = clamped.x
    yRef.current = clamped.y
    setX(clamped.x)
    setY(clamped.y)
  }, [containerRef, x])

  // ── Drag ──────────────────────────────────────────────────────────────────
  const handleDragStart = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    const startMx = e.clientX
    const startMy = e.clientY
    const startX  = xRef.current
    const startY  = yRef.current

    document.body.style.cursor = 'grabbing'

    const onMove = (ev: PointerEvent) => {
      const el = containerRef.current
      if (!el) return
      const clamped = clampPos(
        startX + ev.clientX - startMx,
        startY + ev.clientY - startMy,
        sizeRef.current,
        el.offsetWidth,
        el.offsetHeight,
      )
      xRef.current = clamped.x
      yRef.current = clamped.y
      setX(clamped.x)
      setY(clamped.y)
    }

    const onUp = () => {
      document.body.style.cursor = ''
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [containerRef])

  // ── Resize ────────────────────────────────────────────────────────────────
  const handleResizeStart = useCallback((e: React.PointerEvent<HTMLDivElement>, dir: ResizeDir) => {
    e.preventDefault()
    e.stopPropagation()

    const startMx   = e.clientX
    const startMy   = e.clientY
    const startSize = sizeRef.current
    const startX    = xRef.current
    const startY    = yRef.current

    // Determine primary delta axis per direction
    const fromW = dir === 'w' || dir === 'nw' || dir === 'sw'
    const fromN = dir === 'n' || dir === 'nw' || dir === 'ne'
    const fromE = dir === 'e' || dir === 'se' || dir === 'ne'
    const fromS = dir === 's' || dir === 'se' || dir === 'sw'

    const onMove = (ev: PointerEvent) => {
      const el = containerRef.current
      if (!el) return

      const dx = ev.clientX - startMx
      const dy = ev.clientY - startMy

      // Compute delta: positive = bigger
      let delta = 0
      if (fromE && !fromW) delta = dx
      else if (fromW && !fromE) delta = -dx
      else if (fromS && !fromN) delta = dy
      else if (fromN && !fromS) delta = -dy
      else if (fromE && fromS) delta = Math.max(dx, dy)
      else if (fromW && fromS) delta = Math.max(-dx, dy)
      else if (fromE && fromN) delta = Math.max(dx, -dy)
      else if (fromW && fromN) delta = Math.max(-dx, -dy)

      const newSize = Math.max(MIN_SIZE, Math.min(MAX_SIZE, startSize + delta))
      sizeRef.current = newSize
      setSize(newSize)

      // Adjust position for west/north anchors
      let newX = startX
      let newY = startY
      if (fromW) newX = startX + startSize - newSize
      if (fromN) newY = startY + startSize - newSize

      const clamped = clampPos(newX, newY, newSize, el.offsetWidth, el.offsetHeight)
      xRef.current = clamped.x
      yRef.current = clamped.y
      setX(clamped.x)
      setY(clamped.y)
    }

    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [containerRef])

  return {
    mode, setMode,
    x, y, size,
    initPosition, reclamp,
    handleDragStart, handleResizeStart,
  }
}
