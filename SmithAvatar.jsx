import { useEffect, useRef, useState, useCallback } from "react";

// ─── Agent states ────────────────────────────────────────────────────────────
const STATES = {
  idle:      { color: "#00ffaa", speed: 0.3, radius: 1.0, glow: 8,  label: "IDLE",      pulse: false },
  listening: { color: "#00cfff", speed: 0.7, radius: 1.1, glow: 14, label: "LISTENING", pulse: true  },
  thinking:  { color: "#bf00ff", speed: 1.6, radius: 1.2, glow: 20, label: "THINKING",  pulse: true  },
  speaking:  { color: "#00ffaa", speed: 0.9, radius: 1.05,glow: 16, label: "SPEAKING",  pulse: true  },
  error:     { color: "#ff3333", speed: 0.2, radius: 0.9, glow: 10, label: "ERROR",      pulse: false },
};

// ─── Mannequin head shape as a path of [x, y] in normalised -1..1 space ─────
function getMannequinPoints(count = 900) {
  const pts = [];

  // We'll sample the outline + fill of a stylised mannequin head + neck
  // Head: ellipse; neck: trapezoid; glasses: two rectangles

  const rand = (a, b) => a + Math.random() * (b - a);

  // ── Head fill (ellipse) ──────────────────────────────
  let added = 0;
  const headRx = 0.38, headRy = 0.44, headCy = 0.08;
  while (added < count * 0.55) {
    const angle = rand(0, Math.PI * 2);
    const r = Math.sqrt(Math.random());
    const x = r * headRx * Math.cos(angle);
    const y = headCy + r * headRy * Math.sin(angle);
    pts.push({ x, y, zone: "head" });
    added++;
  }

  // ── Neck (narrow rectangle) ──────────────────────────
  added = 0;
  while (added < count * 0.10) {
    const x = rand(-0.09, 0.09);
    const y = rand(-0.42, -0.28);
    pts.push({ x, y, zone: "neck" });
    added++;
  }

  // ── Shoulders (trapezoid base) ────────────────────────
  added = 0;
  while (added < count * 0.08) {
    const t = Math.random();
    const y = rand(-0.56, -0.44);
    const halfW = 0.09 + 0.35 * (1 - (y + 0.56) / 0.12);
    const x = rand(-halfW, halfW);
    pts.push({ x, y, zone: "shoulder" });
    added++;
  }

  // ── Glasses: left lens ───────────────────────────────
  added = 0;
  while (added < count * 0.07) {
    const x = rand(-0.30, -0.06);
    const y = rand(0.10, 0.22);
    // keep inside rounded rect
    const cx = -0.18, cy = 0.16, rx = 0.12, ry = 0.06;
    if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1)
      pts.push({ x, y, zone: "glasses" });
    added++;
  }

  // ── Glasses: right lens ──────────────────────────────
  added = 0;
  while (added < count * 0.07) {
    const x = rand(0.06, 0.30);
    const y = rand(0.10, 0.22);
    const cx = 0.18, cy = 0.16, rx = 0.12, ry = 0.06;
    if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1)
      pts.push({ x, y, zone: "glasses" });
    added++;
  }

  // ── Glasses bridge ───────────────────────────────────
  added = 0;
  while (added < count * 0.03) {
    const x = rand(-0.06, 0.06);
    const y = rand(0.14, 0.18);
    pts.push({ x, y, zone: "bridge" });
    added++;
  }

  // ── Scanline noise (random scatter inside head) ──────
  added = 0;
  while (added < count * 0.10) {
    const angle = rand(0, Math.PI * 2);
    const r = Math.sqrt(Math.random()) * 0.85;
    const x = r * headRx * Math.cos(angle);
    const y = headCy + r * headRy * Math.sin(angle);
    // only every-other scanline
    if (Math.floor((y * 100 + 50)) % 4 === 0)
      pts.push({ x, y, zone: "scan" });
    added++;
  }

  return pts;
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function SmithAvatar({ agentState = "idle", size = 380 }) {
  const canvasRef = useRef(null);
  const stateRef  = useRef(agentState);
  const frameRef  = useRef(0);
  const timeRef   = useRef(0);

  // Pre-generate particle positions once
  const particles = useRef(getMannequinPoints(1100));

  useEffect(() => { stateRef.current = agentState; }, [agentState]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext("2d");
    const DPR    = window.devicePixelRatio || 1;
    const W = size * DPR;
    const H = size * DPR;
    canvas.width  = W;
    canvas.height = H;
    canvas.style.width  = size + "px";
    canvas.style.height = size + "px";

    const cx = W / 2;
    const cy = H / 2 + H * 0.06; // shift centre down a touch

    let animId;

    const draw = (ts) => {
      const dt = (ts - timeRef.current) / 1000;
      timeRef.current = ts;
      timeRef.current = ts;
      const t = ts / 1000;

      const cfg = STATES[stateRef.current] || STATES.idle;
      const hex  = cfg.color;
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);

      // clear
      ctx.clearRect(0, 0, W, H);

      // ── Background scanlines ──────────────────────────
      ctx.save();
      for (let sy = 0; sy < H; sy += 6 * DPR) {
        ctx.fillStyle = `rgba(0,${Math.round(g * 0.03)},${Math.round(b * 0.06)},0.18)`;
        ctx.fillRect(0, sy, W, DPR);
      }
      ctx.restore();

      // ── Outer glow ring ──────────────────────────────
      const glowR = W * 0.46;
      const pulseAmp = cfg.pulse ? 0.04 : 0.015;
      const pulsed   = glowR * (1 + pulseAmp * Math.sin(t * cfg.speed * 3));
      const grad = ctx.createRadialGradient(cx, cy - H * 0.02, pulsed * 0.5, cx, cy - H * 0.02, pulsed);
      grad.addColorStop(0,   `rgba(${r},${g},${b},0.0)`);
      grad.addColorStop(0.7, `rgba(${r},${g},${b},0.04)`);
      grad.addColorStop(0.92,`rgba(${r},${g},${b},0.22)`);
      grad.addColorStop(1,   `rgba(${r},${g},${b},0.0)`);
      ctx.beginPath();
      ctx.arc(cx, cy - H * 0.02, pulsed, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // ── Particles ────────────────────────────────────
      const scale    = W * 0.42 * cfg.radius;
      const wobble   = cfg.pulse ? 0.012 : 0.004;

      particles.current.forEach((p, i) => {
        // per-particle drift
        const phase = i * 0.17 + t * cfg.speed * (0.5 + (i % 7) * 0.07);
        const dx = Math.sin(phase)         * wobble * scale;
        const dy = Math.cos(phase * 0.73)  * wobble * scale;

        // thinking: extra swirl
        let sx = 0, sy = 0;
        if (stateRef.current === "thinking") {
          const swirl = t * 1.2 + i * 0.05;
          sx = Math.sin(swirl) * 0.018 * scale * (p.zone === "head" ? 1 : 0.3);
          sy = Math.cos(swirl) * 0.018 * scale * (p.zone === "head" ? 1 : 0.3);
        }

        const px = cx + (p.x * scale) + dx + sx;
        const py = cy - (p.y * scale) + dy + sy; // flip Y

        // per-zone brightness
        const zoneBright = {
          head:     1.0,
          glasses:  1.5,
          bridge:   1.3,
          neck:     0.7,
          shoulder: 0.55,
          scan:     0.35,
        }[p.zone] ?? 1.0;

        // flicker
        const flicker = 0.65 + 0.35 * Math.sin(t * (2 + (i % 5)) + i);
        const alpha   = flicker * zoneBright * (stateRef.current === "error" ? 0.6 : 0.85);

        // dot size
        const dotR = (p.zone === "glasses" || p.zone === "bridge")
          ? 1.5 * DPR
          : (p.zone === "scan" ? 0.7 * DPR : 1.1 * DPR);

        ctx.beginPath();
        ctx.arc(px, py, dotR, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
        ctx.shadowColor = `rgba(${r},${g},${b},0.9)`;
        ctx.shadowBlur  = cfg.glow * DPR * zoneBright;
        ctx.fill();
      });

      ctx.shadowBlur = 0;

      // ── HUD ring (thin circle around head) ───────────
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy - H * 0.08, W * 0.41 * cfg.radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${r},${g},${b},0.18)`;
      ctx.lineWidth   = 1 * DPR;
      ctx.setLineDash([4 * DPR, 8 * DPR]);
      ctx.lineDashOffset = -t * 18;
      ctx.stroke();
      ctx.restore();

      // ── Status label ─────────────────────────────────
      const labelY = cy + H * 0.44;
      ctx.font = `${Math.round(11 * DPR)}px "Courier New", monospace`;
      ctx.textAlign    = "center";
      ctx.fillStyle    = `rgba(${r},${g},${b},0.7)`;
      ctx.shadowColor  = `rgba(${r},${g},${b},0.9)`;
      ctx.shadowBlur   = 8 * DPR;
      ctx.fillText(`[ ${cfg.label} ]`, cx, labelY);

      // ── SMITH title ───────────────────────────────────
      ctx.font         = `bold ${Math.round(15 * DPR)}px "Courier New", monospace`;
      ctx.letterSpacing = "4px";
      ctx.fillStyle    = `rgba(${r},${g},${b},0.9)`;
      ctx.shadowBlur   = 12 * DPR;
      ctx.fillText("A G E N T  S M I T H", cx, labelY + 22 * DPR);
      ctx.shadowBlur   = 0;

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, [size]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        background: "transparent",
        display: "block",
        cursor: "default",
      }}
    />
  );
}


// ─── Demo wrapper (remove if embedding in your app) ──────────────────────────
function Demo() {
  const [state, setState] = useState("idle");

  const states = ["idle", "listening", "thinking", "speaking", "error"];

  return (
    <div style={{
      minHeight: "100vh",
      background: "#050a0e",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Courier New', monospace",
      gap: 32,
    }}>
      {/* Scanline overlay */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 10,
        backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)",
      }} />

      {/* Avatar */}
      <div style={{
        position: "relative",
        filter: "drop-shadow(0 0 24px rgba(0,255,170,0.15))",
      }}>
        <SmithAvatar agentState={state} size={380} />
      </div>

      {/* State buttons */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        {states.map(s => {
          const cfg = STATES[s];
          const active = s === state;
          return (
            <button
              key={s}
              onClick={() => setState(s)}
              style={{
                padding: "8px 18px",
                background: active ? cfg.color + "22" : "transparent",
                border: `1px solid ${active ? cfg.color : "#1a3a2a"}`,
                color: active ? cfg.color : "#3a6a4a",
                fontFamily: "'Courier New', monospace",
                fontSize: 11,
                letterSpacing: 2,
                cursor: "pointer",
                textTransform: "uppercase",
                transition: "all 0.2s",
                borderRadius: 2,
              }}
            >
              {s}
            </button>
          );
        })}
      </div>

      <p style={{
        color: "#1a4a2a",
        fontSize: 10,
        letterSpacing: 3,
        textTransform: "uppercase",
        marginTop: -16,
      }}>
        click state to switch
      </p>
    </div>
  );
}

// Export demo as default for preview
export { Demo as default, SmithAvatar };
