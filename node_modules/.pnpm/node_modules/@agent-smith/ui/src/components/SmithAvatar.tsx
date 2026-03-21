import { useEffect, useRef } from "react"

export type AgentState = "idle" | "listening" | "thinking" | "speaking" | "error"

interface StateCfg {
  color: string
  speed: number
  radius: number
  glow: number
  pulse: boolean
  wobble: number
  swirl: number
}

const STATES: Record<AgentState, StateCfg> = {
  idle:      { color: "#00ffaa", speed: 0.3, radius: 1.0,  glow: 8,  pulse: false, wobble: 0.004, swirl: 0.0  },
  listening: { color: "#00cfff", speed: 0.7, radius: 1.1,  glow: 14, pulse: true,  wobble: 0.012, swirl: 0.0  },
  thinking:  { color: "#bf00ff", speed: 1.6, radius: 1.2,  glow: 20, pulse: true,  wobble: 0.012, swirl: 0.018 },
  speaking:  { color: "#ffaa00", speed: 0.9, radius: 1.05, glow: 16, pulse: true,  wobble: 0.012, swirl: 0.0  },
  error:     { color: "#ff3333", speed: 0.2, radius: 0.9,  glow: 10, pulse: false, wobble: 0.004, swirl: 0.0  },
}

// Interpolated render config — all numeric fields lerped each frame
interface RenderCfg {
  r: number; g: number; b: number
  speed: number
  radius: number
  glow: number
  wobble: number
  swirl: number
  alphaMult: number  // 0.6 for error, 0.85 otherwise
}

const LERP_SPEED = 3.0  // higher = faster transition

interface Particle { x: number; y: number; zone: string }

function getMannequinPoints(count = 900): Particle[] {
  const pts: Particle[] = []
  const rand = (a: number, b: number) => a + Math.random() * (b - a)

  const headRx = 0.38, headRy = 0.38, headCy = 0.05

  // Cheekbone shape: full width from crown down to cheekbone level,
  // then taper toward chin. Cheekbones sit below the glasses (~t = -0.18).
  const cheekStart = -0.18  // t where jaw taper begins
  const faceRx = (y: number) => {
    const t = (y - headCy) / headRy  // -1 (chin) → +1 (crown)
    if (t < cheekStart) {
      // normalize 0 (at cheekbones) → 1 (at chin)
      const u = (t - cheekStart) / (-1 - cheekStart)
      return headRx * (1.0 - 0.30 * Math.pow(u, 0.85))  // jaw taper
    }
    // above cheekbones: very gentle crown taper
    return headRx * (1.0 - 0.10 * Math.pow(Math.max(0, t), 2.2))
  }

  // ── Head fill ───────────────────────────────────────
  let added = 0
  while (added < count * 0.45) {
    const angle = rand(0, Math.PI * 2)
    const r     = Math.sqrt(Math.random())
    const y     = headCy + r * headRy * Math.sin(angle)
    const x     = r * faceRx(y) * Math.cos(angle)
    pts.push({ x, y, zone: "head" })
    added++
  }

  // ── Head outline ring ──────────────────────────────────
  added = 0
  while (added < count * 0.12) {
    const angle = rand(0, Math.PI * 2)
    const r     = 0.90 + rand(0, 0.14)
    const y     = headCy + r * headRy * Math.sin(angle)
    const x     = r * faceRx(y) * Math.cos(angle)
    pts.push({ x, y, zone: "outline" })
    added++
  }

  // ── Neck (narrow rectangle) ──────────────────────────
  added = 0
  while (added < count * 0.10) {
    pts.push({ x: rand(-0.09, 0.09), y: rand(-0.42, -0.28), zone: "neck" })
    added++
  }

  // ── Shoulders (trapezoid base) ────────────────────────
  added = 0
  while (added < count * 0.08) {
    const y = rand(-0.56, -0.44)
    const halfW = 0.09 + 0.35 * (1 - (y + 0.56) / 0.12)
    pts.push({ x: rand(-halfW, halfW), y, zone: "shoulder" })
    added++
  }

  // ── Glasses (rectangular with clear frame edges) ──────
  const lenses = [
    { x0: -0.30, x1: -0.06, y0: 0.11, y1: 0.21 },
    { x0:  0.06, x1:  0.30, y0: 0.11, y1: 0.21 },
  ]
  for (const l of lenses) {
    added = 0
    while (added < count * 0.04) {
      pts.push({ x: rand(l.x0 + 0.01, l.x1 - 0.01), y: rand(l.y0 + 0.005, l.y1 - 0.005), zone: "glasses" })
      added++
    }
    added = 0
    while (added < count * 0.018) {
      pts.push({ x: rand(l.x0, l.x1), y: l.y1 + rand(-0.006, 0.006), zone: "glasses" })
      added++
    }
    added = 0
    while (added < count * 0.018) {
      pts.push({ x: rand(l.x0, l.x1), y: l.y0 + rand(-0.006, 0.006), zone: "glasses" })
      added++
    }
    added = 0
    while (added < count * 0.010) {
      pts.push({ x: l.x0 + rand(-0.006, 0.006), y: rand(l.y0, l.y1), zone: "glasses" })
      added++
    }
    added = 0
    while (added < count * 0.010) {
      pts.push({ x: l.x1 + rand(-0.006, 0.006), y: rand(l.y0, l.y1), zone: "glasses" })
      added++
    }
  }

  // ── Glasses bridge ────────────────────────────────────
  added = 0
  while (added < count * 0.03) {
    pts.push({ x: rand(-0.06, 0.06), y: rand(0.14, 0.18), zone: "bridge" })
    added++
  }

  // ── Mouth ─────────────────────────────────────────────
  // Neutral expression: straight parting line, subtle lips, corners level
  const mouthY  = -0.105   // vertical center of mouth
  const mouthW  =  0.075   // half-width — narrower
  const lipGap  =  0.004   // half of parting gap

  // Lip parting line — thin, nearly straight
  added = 0
  while (added < count * 0.014) {
    const x = rand(-mouthW, mouthW)
    const curve = 0.004 * (1 - (x / mouthW) ** 2)
    const y = mouthY + curve + rand(-0.003, 0.003)
    pts.push({ x, y, zone: "mouth" })
    added++
  }

  // Upper lip — very thin
  added = 0
  while (added < count * 0.008) {
    const x = rand(-mouthW, mouthW)
    const bow = -0.004 * Math.exp(-((x / 0.04) ** 2))
    const yTop = mouthY + lipGap + 0.010 + bow
    const y = rand(mouthY + lipGap, yTop)
    pts.push({ x, y, zone: "mouth" })
    added++
  }

  // Lower lip — slightly fuller but still subtle
  added = 0
  while (added < count * 0.010) {
    const x = rand(-mouthW, mouthW)
    const swell = 0.009 * (1 - (x / mouthW) ** 2)
    const yBot = mouthY - lipGap - swell
    const y = rand(yBot, mouthY - lipGap)
    pts.push({ x, y, zone: "mouth" })
    added++
  }

  // Corners
  for (const sx of [-1, 1]) {
    added = 0
    while (added < count * 0.004) {
      const x = sx * mouthW + rand(-0.008, 0.003 * sx)
      const y = mouthY + rand(-0.007, 0.007)
      pts.push({ x, y, zone: "mouth" })
      added++
    }
  }

  // ── Scanline noise ────────────────────────────────────
  added = 0
  while (added < count * 0.10) {
    const angle = rand(0, Math.PI * 2)
    const r = Math.sqrt(Math.random()) * 0.85
    const x = r * headRx * Math.cos(angle)
    const y = headCy + r * headRy * Math.sin(angle)
    if (Math.floor((y * 100 + 50)) % 4 === 0)
      pts.push({ x, y, zone: "scan" })
    added++
  }

  return pts
}

function hexToRgb(hex: string) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  }
}

interface SmithAvatarProps { agentState?: AgentState; size?: number }

export default function SmithAvatar({ agentState = "idle", size = 380 }: SmithAvatarProps) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const stateRef   = useRef<AgentState>(agentState)
  const renderRef  = useRef<RenderCfg | null>(null)
  const prevTsRef  = useRef<number>(0)
  const particles  = useRef<Particle[]>(getMannequinPoints(1100))

  useEffect(() => { stateRef.current = agentState }, [agentState])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!
    const DPR = window.devicePixelRatio || 1
    const W = size * DPR, H = size * DPR
    canvas.width = W; canvas.height = H
    canvas.style.width = size + "px"; canvas.style.height = size + "px"

    const cx = W / 2
    const cy = H / 2 + H * 0.03

    // Seed render config from initial state (no lerp on first frame)
    const initCfg = STATES[stateRef.current]
    const initRgb = hexToRgb(initCfg.color)
    renderRef.current = {
      r: initRgb.r, g: initRgb.g, b: initRgb.b,
      speed:     initCfg.speed,
      radius:    initCfg.radius,
      glow:      initCfg.glow,
      wobble:    initCfg.wobble,
      swirl:     initCfg.swirl,
      alphaMult: stateRef.current === "error" ? 0.6 : 0.85,
    }

    let animId: number

    const draw = (ts: number) => {
      const dt = Math.min((ts - prevTsRef.current) / 1000, 0.1)
      prevTsRef.current = ts
      const t = ts / 1000

      // ── Lerp render config toward target state ────────
      const target = STATES[stateRef.current] ?? STATES.idle
      const tRgb   = hexToRgb(target.color)
      const tAlpha = stateRef.current === "error" ? 0.6 : 0.85
      const rc     = renderRef.current!
      const k      = dt > 0 ? 1 - Math.exp(-LERP_SPEED * dt) : 0

      rc.r         += (tRgb.r    - rc.r)         * k
      rc.g         += (tRgb.g    - rc.g)         * k
      rc.b         += (tRgb.b    - rc.b)         * k
      rc.speed     += (target.speed    - rc.speed)     * k
      rc.radius    += (target.radius   - rc.radius)    * k
      rc.glow      += (target.glow     - rc.glow)      * k
      rc.wobble    += (target.wobble   - rc.wobble)    * k
      rc.swirl     += (target.swirl    - rc.swirl)     * k
      rc.alphaMult += (tAlpha          - rc.alphaMult) * k

      const { r, g, b, speed, radius, glow, wobble, swirl, alphaMult } = rc

      ctx.clearRect(0, 0, W, H)

      // ── Particles ────────────────────────────────────
      const scale = W * 0.79 * radius

      const zoneBright: Record<string, number> = {
        head:     1.0,
        outline:  1.4,
        glasses:  1.6,
        bridge:   1.3,
        mouth:    1.05,
        neck:     0.7,
        shoulder: 0.55,
        scan:     0.35,
      }

      particles.current.forEach((p, i) => {
        const phase = i * 0.17 + t * speed * (0.5 + (i % 7) * 0.07)
        const dx = Math.sin(phase)        * wobble * scale
        const dy = Math.cos(phase * 0.73) * wobble * scale

        const swirlAngle = t * 1.2 + i * 0.05
        const swirlScale = swirl * scale * (p.zone === "head" ? 1 : 0.3)
        const sx = Math.sin(swirlAngle) * swirlScale
        const sy = Math.cos(swirlAngle) * swirlScale

        const px = cx + p.x * scale + dx + sx
        const py = cy - p.y * scale + dy + sy

        const zb      = zoneBright[p.zone] ?? 1.0
        const flicker = 0.65 + 0.35 * Math.sin(t * (2 + (i % 5)) + i)
        const alpha   = flicker * zb * alphaMult

        const dotR = p.zone === "glasses" || p.zone === "bridge"
          ? 1.6 * DPR
          : p.zone === "mouth"
            ? 1.1 * DPR
            : p.zone === "outline"
              ? 1.3 * DPR
              : p.zone === "scan"
                ? 0.7 * DPR
                : 1.1 * DPR

        ctx.beginPath()
        ctx.arc(px, py, dotR, 0, Math.PI * 2)
        ctx.fillStyle   = `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${alpha.toFixed(3)})`
        ctx.shadowColor = `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},0.9)`
        ctx.shadowBlur  = glow * DPR * zb
        ctx.fill()
      })

      ctx.shadowBlur = 0

      animId = requestAnimationFrame(draw)
    }

    animId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animId)
  }, [size])

  return (
    <canvas ref={canvasRef} style={{ background: "transparent", display: "block", cursor: "default" }} />
  )
}
