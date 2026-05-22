"use client"

import createGlobe from "cobe"
import { useEffect, useRef, useState } from "react"

// ─── Canonical data schema ────────────────────────────────────────────────

export type Point = {
  id: string
  lat: number
  lng: number
  label?: string
  value?: number
  color?: string
}

export type Arc = {
  from: string
  to: string
  color?: string
  value?: number
  animated?: boolean
}

// ─── Component prop surface ───────────────────────────────────────────────

export type GlobeProps = {
  points?: Point[]
  arcs?: Arc[]

  baseColor?: string
  markerColor?: string
  glowColor?: string
  arcColor?: string
  background?: string
  dark?: number
  diffuse?: number
  mapBrightness?: number
  mapSamples?: number

  autoRotate?: boolean
  rotateSpeed?: number
  dragEnabled?: boolean
  initialPhi?: number
  initialTheta?: number

  markerRadius?: number
  hoverScale?: number
  onMarkerClick?: (point: Point) => void
  onMarkerHover?: (point: Point | null) => void

  className?: string
  style?: React.CSSProperties
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function hexToRgb01(hex: string): [number, number, number] {
  const cleaned = hex.replace("#", "")
  const full =
    cleaned.length === 3
      ? cleaned
          .split("")
          .map((c) => c + c)
          .join("")
      : cleaned
  const r = parseInt(full.slice(0, 2), 16) / 255
  const g = parseInt(full.slice(2, 4), 16) / 255
  const b = parseInt(full.slice(4, 6), 16) / 255
  return [r, g, b]
}

type Vec3 = { x: number; y: number; z: number }

function latLngToVec3(latDeg: number, lngDeg: number): Vec3 {
  const lat = (latDeg * Math.PI) / 180
  const lng = (lngDeg * Math.PI) / 180
  return {
    x: Math.cos(lat) * Math.sin(lng),
    y: Math.sin(lat),
    z: Math.cos(lat) * Math.cos(lng),
  }
}

function rotateVec3(v: Vec3, phi: number, theta: number): Vec3 {
  // rotate around Y by phi (cobe spins this direction)
  const cosPhi = Math.cos(-phi)
  const sinPhi = Math.sin(-phi)
  const x1 = v.x * cosPhi + v.z * sinPhi
  const z1 = -v.x * sinPhi + v.z * cosPhi
  // tilt around X by theta
  const cosT = Math.cos(theta)
  const sinT = Math.sin(theta)
  const y2 = v.y * cosT - z1 * sinT
  const z2 = v.y * sinT + z1 * cosT
  return { x: x1, y: y2, z: z2 }
}

// ─── Component ────────────────────────────────────────────────────────────

export function Globe(props: GlobeProps) {
  const {
    points = [],
    arcs = [],

    baseColor = "#1d2942",
    markerColor = "#ffd166",
    glowColor = "#3a8bff",
    arcColor = "#ffd166",
    background = "#000",
    dark = 1,
    diffuse = 1.2,
    mapBrightness = 6,
    mapSamples = 16000,

    autoRotate = true,
    rotateSpeed = 0.004,
    dragEnabled = true,
    initialPhi = 0,
    initialTheta = 0.3,

    markerRadius = 4,
    hoverScale = 2,
    onMarkerClick,
    onMarkerHover,

    className,
    style,
  } = props

  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const markerCircleRefs = useRef<Map<string, SVGCircleElement>>(new Map())
  const arcPathRefs = useRef<Map<string, SVGPathElement>>(new Map())

  // mutable refs so the cobe onRender closure always reads fresh data
  // and changing points/arcs doesn't re-create the globe
  const pointsRef = useRef(points)
  const arcsRef = useRef(arcs)
  pointsRef.current = points
  arcsRef.current = arcs

  // rotation state
  const phiRef = useRef(initialPhi)
  const widthRef = useRef(0)
  const heightRef = useRef(0)
  const pointerDownAt = useRef<number | null>(null)
  const pointerDelta = useRef(0)
  const userPhi = useRef(0)

  const [hovered, setHovered] = useState<Point | null>(null)
  const hoveredId = hovered?.id ?? null

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const updateSize = () => {
      widthRef.current = container.clientWidth
      heightRef.current = container.clientHeight
    }
    updateSize()
    const ro = new ResizeObserver(updateSize)
    ro.observe(container)

    const theta = initialTheta

    const globe = createGlobe(canvas, {
      devicePixelRatio: 2,
      width: widthRef.current * 2,
      height: heightRef.current * 2,
      phi: initialPhi,
      theta,
      dark,
      diffuse,
      mapSamples,
      mapBrightness,
      baseColor: hexToRgb01(baseColor),
      markerColor: hexToRgb01(markerColor),
      glowColor: hexToRgb01(glowColor),
      // we render our own markers via the SVG overlay for hover/click + per-point color
      markers: [],
      onRender: (state) => {
        if (autoRotate && pointerDownAt.current === null) {
          phiRef.current += rotateSpeed
        }
        const phi = phiRef.current + userPhi.current
        state.phi = phi
        state.width = widthRef.current * 2
        state.height = heightRef.current * 2

        const w = widthRef.current
        const h = heightRef.current
        const radius = Math.min(w, h) / 2 - 4

        // ── update marker positions in SVG overlay
        for (const p of pointsRef.current) {
          const el = markerCircleRefs.current.get(p.id)
          if (!el) continue
          const rotated = rotateVec3(latLngToVec3(p.lat, p.lng), phi, theta)
          const sx = w / 2 + rotated.x * radius
          const sy = h / 2 - rotated.y * radius
          const visible = rotated.z > -0.05
          el.setAttribute("cx", String(sx))
          el.setAttribute("cy", String(sy))
          const opacity = visible ? Math.min(1, 0.4 + rotated.z) : 0
          el.setAttribute("opacity", String(opacity))
          el.style.pointerEvents = visible ? "auto" : "none"
        }

        // ── update arc paths in SVG overlay
        const byId = new Map(pointsRef.current.map((p) => [p.id, p]))
        for (const arc of arcsRef.current) {
          const path = arcPathRefs.current.get(`${arc.from}-${arc.to}`)
          if (!path) continue
          const a = byId.get(arc.from)
          const b = byId.get(arc.to)
          if (!a || !b) {
            path.setAttribute("d", "")
            continue
          }
          const v1 = latLngToVec3(a.lat, a.lng)
          const v2 = latLngToVec3(b.lat, b.lng)

          // arc midpoint lifted off the surface, scale with chord length
          const mx = (v1.x + v2.x) / 2
          const my = (v1.y + v2.y) / 2
          const mz = (v1.z + v2.z) / 2
          const ml = Math.sqrt(mx * mx + my * my + mz * mz) || 1
          const dx = v2.x - v1.x
          const dy = v2.y - v1.y
          const dz = v2.z - v1.z
          const chord = Math.sqrt(dx * dx + dy * dy + dz * dz)
          const lift = 1 + Math.min(chord * 0.4, 0.55)
          const cm: Vec3 = {
            x: (mx / ml) * lift,
            y: (my / ml) * lift,
            z: (mz / ml) * lift,
          }

          const segments = 36
          let d = ""
          let drawing = false
          for (let i = 0; i <= segments; i++) {
            const t = i / segments
            const u = 1 - t
            const bx = u * u * v1.x + 2 * u * t * cm.x + t * t * v2.x
            const by = u * u * v1.y + 2 * u * t * cm.y + t * t * v2.y
            const bz = u * u * v1.z + 2 * u * t * cm.z + t * t * v2.z

            const rot = rotateVec3({ x: bx, y: by, z: bz }, phi, theta)
            const sx = w / 2 + rot.x * radius
            const sy = h / 2 - rot.y * radius
            const visible = rot.z > -0.05

            if (visible) {
              d += `${drawing ? "L" : "M"}${sx.toFixed(2)} ${sy.toFixed(2)} `
              drawing = true
            } else {
              drawing = false
            }
          }
          path.setAttribute("d", d.trim())
        }
      },
    })

    // fade in after first frame
    requestAnimationFrame(() => {
      canvas.style.opacity = "1"
    })

    return () => {
      globe.destroy()
      ro.disconnect()
    }
  }, [
    baseColor,
    markerColor,
    glowColor,
    dark,
    diffuse,
    mapBrightness,
    mapSamples,
    autoRotate,
    rotateSpeed,
    initialPhi,
    initialTheta,
  ])

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!dragEnabled) return
    pointerDownAt.current = e.clientX - pointerDelta.current
    if (canvasRef.current) canvasRef.current.style.cursor = "grabbing"
  }
  const handlePointerUp = () => {
    pointerDownAt.current = null
    if (canvasRef.current) canvasRef.current.style.cursor = "grab"
  }
  const handlePointerMove = (e: React.PointerEvent) => {
    if (pointerDownAt.current !== null) {
      pointerDelta.current = e.clientX - pointerDownAt.current
      userPhi.current = pointerDelta.current / 200
    }
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        background,
        ...style,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "100%",
          opacity: 0,
          transition: "opacity 0.6s ease-out",
          cursor: dragEnabled ? "grab" : "default",
          touchAction: "none",
          contain: "layout paint size",
        }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerMove={handlePointerMove}
      />

      <svg
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          overflow: "visible",
        }}
      >
        {arcs.map((arc) => (
          <path
            key={`${arc.from}-${arc.to}`}
            ref={(el) => {
              const key = `${arc.from}-${arc.to}`
              if (el) arcPathRefs.current.set(key, el)
              else arcPathRefs.current.delete(key)
            }}
            stroke={arc.color ?? arcColor}
            strokeWidth={1.5}
            strokeOpacity={0.9}
            strokeLinecap="round"
            fill="none"
          />
        ))}

        {points.map((p) => (
          <circle
            key={p.id}
            ref={(el) => {
              if (el) markerCircleRefs.current.set(p.id, el)
              else markerCircleRefs.current.delete(p.id)
            }}
            r={hoveredId === p.id ? markerRadius * hoverScale : markerRadius}
            fill={p.color ?? markerColor}
            stroke="rgba(0,0,0,0.35)"
            strokeWidth={1}
            style={{
              cursor: "pointer",
              transition: "r 150ms ease-out",
              pointerEvents: "auto",
            }}
            onMouseEnter={() => {
              setHovered(p)
              onMarkerHover?.(p)
            }}
            onMouseLeave={() => {
              setHovered(null)
              onMarkerHover?.(null)
            }}
            onClick={() => onMarkerClick?.(p)}
          />
        ))}
      </svg>
    </div>
  )
}

export default Globe
