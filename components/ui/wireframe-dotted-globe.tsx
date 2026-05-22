"use client"

import * as d3 from "d3"
import { useEffect, useRef, useState } from "react"

// ─── Canonical data schema (shared across the project) ─────────────────────

export type Point = {
  id: string
  lat: number
  lng: number
  label?: string
  value?: number
  color?: string
  meta?: Record<string, unknown>
  /** "city" renders a dot at lat/lng; "country" fills the matching country shape */
  kind?: "city" | "country"
  /** ISO-3166-1 alpha-2 (e.g. "JP", "US") — used to match a country geometry */
  countryCode?: string

  // Rich hover-tooltip content (all optional — tooltip only renders fields that are filled)
  subtitle?: string
  description?: string
  imageUrl?: string
  linkUrl?: string
}

export type Arc = {
  from: string
  to: string
  color?: string
  value?: number
}

// ─── Math helpers ──────────────────────────────────────────────────────────

function latLngToVec3(latDeg: number, lngDeg: number) {
  const lat = (latDeg * Math.PI) / 180
  const lng = (lngDeg * Math.PI) / 180
  return {
    x: Math.cos(lat) * Math.sin(lng),
    y: Math.sin(lat),
    z: Math.cos(lat) * Math.cos(lng),
  }
}

// ─── Component prop surface ────────────────────────────────────────────────

interface RotatingEarthProps {
  // sizing
  width?: number
  height?: number
  className?: string

  // data
  points?: Point[]
  arcs?: Arc[]

  // appearance
  oceanColor?: string
  globeStrokeColor?: string
  landStyle?: "dotted" | "filled" | "outline"
  landFillColor?: string
  landStrokeColor?: string
  graticuleColor?: string
  graticuleOpacity?: number
  dotColor?: string
  dotSize?: number
  dotSpacing?: number
  showCountryBorders?: boolean
  countryStrokeColor?: string
  countryStrokeOpacity?: number
  countryStrokeWidth?: number
  markerColor?: string
  arcColor?: string
  arcOpacity?: number
  arcWidth?: number
  arcLift?: number // 0 = flat on surface, 1 = strongly lifted (default 0.6)

  // interactions
  autoRotate?: boolean
  rotateSpeed?: number
  dragEnabled?: boolean
  zoomEnabled?: boolean

  // markers
  markerRadius?: number
  hoverScale?: number
  onMarkerHover?: (p: Point | null, screenPos?: { x: number; y: number }) => void
  onMarkerClick?: (p: Point) => void

  /** When true the canvas cursor is a crosshair and a click on the globe surface fires onSurfaceClick */
  dropMode?: boolean
  onSurfaceClick?: (lat: number, lng: number) => void

  // ui hint
  showHint?: boolean
}

export default function RotatingEarth({
  width = 800,
  height = 600,
  className = "",
  points = [],
  arcs = [],

  oceanColor = "#000000",
  globeStrokeColor = "#ffffff",
  landStyle = "dotted",
  landFillColor = "#e7e2d3",
  landStrokeColor = "#ffffff",
  graticuleColor = "#ffffff",
  graticuleOpacity = 0.25,
  dotColor = "#999999",
  dotSize = 1.2,
  dotSpacing = 16,
  showCountryBorders = false,
  countryStrokeColor = "#94a3b8",
  countryStrokeOpacity = 0.6,
  countryStrokeWidth = 0.6,
  markerColor = "#facc15",
  arcColor = "#ffffff",
  arcOpacity = 0.55,
  arcWidth = 1,
  arcLift = 0.6,

  autoRotate = true,
  rotateSpeed = 0.5,
  dragEnabled = true,
  zoomEnabled = true,

  markerRadius = 4,
  hoverScale = 1.9,
  onMarkerHover,
  onMarkerClick,
  dropMode = false,
  onSurfaceClick,

  showHint = true,
}: RotatingEarthProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const markerCircleRefs = useRef<Map<string, SVGCircleElement>>(new Map())
  const countryPathRefs = useRef<Map<string, SVGPathElement>>(new Map())
  const arcPathRefs = useRef<Map<string, SVGPathElement>>(new Map())
  const countryByCodeRef = useRef<Map<string, any>>(new Map())
  const countryByNameRef = useRef<Map<string, any>>(new Map())

  // refs so render() always reads the freshest props without recreating canvas
  const pointsRef = useRef(points)
  const arcsRef = useRef(arcs)
  const themeRef = useRef({
    oceanColor,
    globeStrokeColor,
    landStyle,
    landFillColor,
    landStrokeColor,
    graticuleColor,
    graticuleOpacity,
    dotColor,
    dotSize,
    showCountryBorders,
    countryStrokeColor,
    countryStrokeOpacity,
    countryStrokeWidth,
    arcColor,
    arcOpacity,
    arcWidth,
    arcLift,
  })
  const renderRef = useRef<(() => void) | null>(null)
  const onSurfaceClickRef = useRef(onSurfaceClick)
  onSurfaceClickRef.current = onSurfaceClick
  const autoRotateRef = useRef(autoRotate)
  autoRotateRef.current = autoRotate
  const rotateSpeedRef = useRef(rotateSpeed)
  rotateSpeedRef.current = rotateSpeed

  pointsRef.current = points
  arcsRef.current = arcs
  themeRef.current = {
    oceanColor,
    globeStrokeColor,
    landStyle,
    landFillColor,
    landStrokeColor,
    graticuleColor,
    graticuleOpacity,
    dotColor,
    dotSize,
    showCountryBorders,
    countryStrokeColor,
    countryStrokeOpacity,
    countryStrokeWidth,
    arcColor,
    arcOpacity,
    arcWidth,
    arcLift,
  }

  const [error, setError] = useState<string | null>(null)
  const [hovered, setHovered] = useState<Point | null>(null)
  const hoveredId = hovered?.id ?? null

  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const context = canvas.getContext("2d")
    if (!context) return

    const containerWidth = Math.min(width, window.innerWidth - 40)
    const containerHeight = Math.min(height, window.innerHeight - 100)
    const baseRadius = Math.min(containerWidth, containerHeight) / 2.5

    const dpr = window.devicePixelRatio || 1
    canvas.width = containerWidth * dpr
    canvas.height = containerHeight * dpr
    canvas.style.width = `${containerWidth}px`
    canvas.style.height = `${containerHeight}px`
    context.scale(dpr, dpr)

    const projection = d3
      .geoOrthographic()
      .scale(baseRadius)
      .translate([containerWidth / 2, containerHeight / 2])
      .clipAngle(90)

    const path = d3.geoPath().projection(projection).context(context)
    // Same projection, no context → returns SVG path string. Used for country fills in the overlay.
    const pathSvg = d3.geoPath().projection(projection)

    // ── land-dot generation (run once after GeoJSON loads) ───────────────────

    const pointInPolygon = (
      pt: [number, number],
      polygon: number[][],
    ): boolean => {
      const [x, y] = pt
      let inside = false
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const [xi, yi] = polygon[i]
        const [xj, yj] = polygon[j]
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
          inside = !inside
        }
      }
      return inside
    }

    const pointInFeature = (pt: [number, number], feature: any): boolean => {
      const g = feature.geometry
      if (g.type === "Polygon") {
        if (!pointInPolygon(pt, g.coordinates[0])) return false
        for (let i = 1; i < g.coordinates.length; i++) {
          if (pointInPolygon(pt, g.coordinates[i])) return false
        }
        return true
      }
      if (g.type === "MultiPolygon") {
        for (const poly of g.coordinates) {
          if (pointInPolygon(pt, poly[0])) {
            let inHole = false
            for (let i = 1; i < poly.length; i++) {
              if (pointInPolygon(pt, poly[i])) {
                inHole = true
                break
              }
            }
            if (!inHole) return true
          }
        }
      }
      return false
    }

    const generateDotsInPolygon = (feature: any, spacing: number) => {
      const dots: [number, number][] = []
      const [[minLng, minLat], [maxLng, maxLat]] = d3.geoBounds(feature)
      const step = spacing * 0.08
      for (let lng = minLng; lng <= maxLng; lng += step) {
        for (let lat = minLat; lat <= maxLat; lat += step) {
          const p: [number, number] = [lng, lat]
          if (pointInFeature(p, feature)) dots.push(p)
        }
      }
      return dots
    }

    const allDots: { lng: number; lat: number }[] = []
    let landFeatures: any = null
    let countryFeatures: any = null

    // ── render loop ──────────────────────────────────────────────────────────

    const render = () => {
      const t = themeRef.current
      context.clearRect(0, 0, containerWidth, containerHeight)

      const currentScale = projection.scale()
      const scaleFactor = currentScale / baseRadius

      // ocean disk
      context.beginPath()
      context.arc(
        containerWidth / 2,
        containerHeight / 2,
        currentScale,
        0,
        2 * Math.PI,
      )
      context.fillStyle = t.oceanColor
      context.fill()
      context.strokeStyle = t.globeStrokeColor
      context.lineWidth = 2 * scaleFactor
      context.stroke()

      if (landFeatures) {
        // graticule
        const graticule = d3.geoGraticule()
        context.beginPath()
        path(graticule())
        context.strokeStyle = t.graticuleColor
        context.lineWidth = 1 * scaleFactor
        context.globalAlpha = t.graticuleOpacity
        context.stroke()
        context.globalAlpha = 1

        // land — build the path once, then fill/stroke according to style
        context.beginPath()
        landFeatures.features.forEach((f: any) => path(f))

        if (t.landStyle === "filled") {
          context.fillStyle = t.landFillColor
          context.fill()
        }

        if (t.landStyle !== "outline" || t.landStrokeColor) {
          // outlines drawn on top of fill (or alone, for outline mode)
          context.strokeStyle = t.landStrokeColor
          context.lineWidth = 1 * scaleFactor
          context.stroke()
        }

        if (t.landStyle === "dotted") {
          // halftone land dots
          context.fillStyle = t.dotColor
          for (const d of allDots) {
            const projected = projection([d.lng, d.lat])
            if (
              projected &&
              projected[0] >= 0 &&
              projected[0] <= containerWidth &&
              projected[1] >= 0 &&
              projected[1] <= containerHeight
            ) {
              context.beginPath()
              context.arc(
                projected[0],
                projected[1],
                t.dotSize * scaleFactor,
                0,
                2 * Math.PI,
              )
              context.fill()
            }
          }
        }

        // country borders (drawn over land fill/dots)
        if (t.showCountryBorders && countryFeatures) {
          context.beginPath()
          countryFeatures.features.forEach((f: any) => path(f))
          context.strokeStyle = t.countryStrokeColor
          context.lineWidth = t.countryStrokeWidth * scaleFactor
          context.globalAlpha = t.countryStrokeOpacity
          context.stroke()
          context.globalAlpha = 1
        }
      }

      // ── SVG overlay updates (markers + arcs) ────────────────────────────

      // common rotation/projection state for marker + arc passes
      const byId = new Map(pointsRef.current.map((p) => [p.id, p]))
      const rotation = projection.rotate()
      const rotator = d3.geoRotation(rotation)
      const projScale = projection.scale()
      const [projCx, projCy] = projection.translate()

      // markers — country shapes render as filled SVG paths; cities render as dots.
      // Visibility for cities comes from rotated z; for countries d3.geoPath naturally
      // clips to the visible hemisphere via projection.clipAngle(90).
      const countryByCode = countryByCodeRef.current
      const countryByName = countryByNameRef.current

      for (const p of pointsRef.current) {
        const circleEl = markerCircleRefs.current.get(p.id)
        const pathEl = countryPathRefs.current.get(p.id)

        // Try country-shape rendering first
        if (p.kind === "country") {
          const feature =
            (p.countryCode &&
              countryByCode.get(p.countryCode.toUpperCase())) ||
            (p.label && countryByName.get(p.label.toLowerCase())) ||
            null
          if (feature && pathEl) {
            const d = pathSvg(feature) ?? ""
            if (d) {
              pathEl.setAttribute("d", d)
              pathEl.setAttribute("opacity", "1")
              pathEl.style.pointerEvents = "auto"
            } else {
              pathEl.setAttribute("d", "")
              pathEl.setAttribute("opacity", "0")
              pathEl.style.pointerEvents = "none"
            }
            if (circleEl) {
              circleEl.setAttribute("opacity", "0")
              circleEl.style.pointerEvents = "none"
            }
            continue
          }
          // fallthrough: country with no matching feature → render as a dot
        }

        // City / default dot render
        if (pathEl) {
          pathEl.setAttribute("d", "")
          pathEl.setAttribute("opacity", "0")
          pathEl.style.pointerEvents = "none"
        }
        if (circleEl) {
          const [rLng, rLat] = rotator([p.lng, p.lat])
          const v = latLngToVec3(rLat, rLng)
          const visible = v.z > 0
          if (!visible) {
            circleEl.setAttribute("opacity", "0")
            circleEl.style.pointerEvents = "none"
          } else {
            const sx = projScale * v.x + projCx
            const sy = -projScale * v.y + projCy
            circleEl.setAttribute("cx", String(sx))
            circleEl.setAttribute("cy", String(sy))
            circleEl.setAttribute("opacity", "1")
            circleEl.style.pointerEvents = "auto"
          }
        }
      }

      // arcs — lifted 3D bezier (off-surface "flight path"), projected ortho with the same rotation d3 uses
      const segments = 64
      for (const arc of arcsRef.current) {
        const el = arcPathRefs.current.get(`${arc.from}-${arc.to}`)
        if (!el) continue
        const a = byId.get(arc.from)
        const b = byId.get(arc.to)
        if (!a || !b) {
          el.setAttribute("d", "")
          continue
        }

        // Rotate endpoints into d3's rotated frame, then lift in 3D
        const ra = rotator([a.lng, a.lat])
        const rb = rotator([b.lng, b.lat])
        const v1 = latLngToVec3(ra[1], ra[0])
        const v2 = latLngToVec3(rb[1], rb[0])

        const mx = (v1.x + v2.x) / 2
        const my = (v1.y + v2.y) / 2
        const mz = (v1.z + v2.z) / 2
        const mlen = Math.sqrt(mx * mx + my * my + mz * mz) || 1
        const dx = v2.x - v1.x
        const dy = v2.y - v1.y
        const dz = v2.z - v1.z
        const chord = Math.sqrt(dx * dx + dy * dy + dz * dz) // 0..2
        // chord 0 → 1.0 (no lift), chord 2 (antipodal) → 1 + arcLift
        const lift = 1 + Math.min(chord * 0.5, 1) * t.arcLift
        const cm = {
          x: (mx / mlen) * lift,
          y: (my / mlen) * lift,
          z: (mz / mlen) * lift,
        }

        let d = ""
        let drawing = false
        for (let i = 0; i <= segments; i++) {
          const tNorm = i / segments
          const u = 1 - tNorm
          const bx = u * u * v1.x + 2 * u * tNorm * cm.x + tNorm * tNorm * v2.x
          const by = u * u * v1.y + 2 * u * tNorm * cm.y + tNorm * tNorm * v2.y
          const bz = u * u * v1.z + 2 * u * tNorm * cm.z + tNorm * tNorm * v2.z

          // Orthographic projection
          const sx = projScale * bx + projCx
          const sy = -projScale * by + projCy
          // Visible if the bezier point is on the camera-facing side.
          // Slight negative tolerance so the curve doesn't snap at the horizon.
          const visible = bz > -0.08

          if (visible) {
            d += `${drawing ? "L" : "M"}${sx.toFixed(2)} ${sy.toFixed(2)} `
            drawing = true
          } else {
            drawing = false
          }
        }
        el.setAttribute("d", d.trim())
        el.setAttribute("stroke", arc.color ?? t.arcColor)
        el.setAttribute("stroke-opacity", String(t.arcOpacity))
        el.setAttribute("stroke-width", String(t.arcWidth))
      }
    }
    renderRef.current = render

    // ── world data load ──────────────────────────────────────────────────

    const LAND_URL =
      "https://raw.githubusercontent.com/martynafford/natural-earth-geojson/refs/heads/master/110m/physical/ne_110m_land.json"
    const COUNTRIES_URL =
      "https://raw.githubusercontent.com/martynafford/natural-earth-geojson/refs/heads/master/110m/cultural/ne_110m_admin_0_countries.json"

    const loadWorldData = async () => {
      try {
        const [landRes, countryRes] = await Promise.allSettled([
          fetch(LAND_URL),
          fetch(COUNTRIES_URL),
        ])

        if (landRes.status === "fulfilled" && landRes.value.ok) {
          landFeatures = await landRes.value.json()
          landFeatures.features.forEach((f: any) => {
            const dots = generateDotsInPolygon(f, dotSpacing)
            dots.forEach(([lng, lat]) => allDots.push({ lng, lat }))
          })
        } else {
          throw new Error("Failed to load land data")
        }

        if (countryRes.status === "fulfilled" && countryRes.value.ok) {
          countryFeatures = await countryRes.value.json()
          // build lookup maps for country-shape markers
          const byCode = new Map<string, any>()
          const byName = new Map<string, any>()
          countryFeatures.features.forEach((f: any) => {
            const props = f.properties ?? {}
            const iso =
              props.ISO_A2 ?? props.iso_a2 ?? props.ISO_A2_EH ?? null
            const name =
              props.ADMIN ??
              props.NAME ??
              props.NAME_LONG ??
              props.name ??
              null
            if (iso && iso !== "-99")
              byCode.set(String(iso).toUpperCase(), f)
            if (name) byName.set(String(name).toLowerCase(), f)
          })
          countryByCodeRef.current = byCode
          countryByNameRef.current = byName
        }
        // country fetch failing is non-fatal — globe still renders without borders

        render()
      } catch (err) {
        setError("Failed to load land map data")
      }
    }

    // ── rotation + interaction ───────────────────────────────────────────

    const rotation: [number, number] = [0, 0]
    let pointerActive = false

    const rotate = () => {
      if (autoRotateRef.current && !pointerActive) {
        rotation[0] += rotateSpeedRef.current
        projection.rotate(rotation)
        render()
      }
    }

    const rotationTimer = d3.timer(rotate)

    const handleMouseDown = (event: MouseEvent) => {
      if (!dragEnabled) return
      pointerActive = true
      const startX = event.clientX
      const startY = event.clientY
      const startRotation: [number, number] = [rotation[0], rotation[1]]
      const rect = canvas.getBoundingClientRect()
      const downCanvasX = event.clientX - rect.left
      const downCanvasY = event.clientY - rect.top
      let movedDistance = 0

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const sensitivity = 0.5
        const dx = moveEvent.clientX - startX
        const dy = moveEvent.clientY - startY
        movedDistance = Math.max(movedDistance, Math.sqrt(dx * dx + dy * dy))
        rotation[0] = startRotation[0] + dx * sensitivity
        rotation[1] = Math.max(
          -90,
          Math.min(90, startRotation[1] - dy * sensitivity),
        )
        projection.rotate(rotation)
        render()
      }
      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)

        // Treat as click (not drag) if pointer barely moved
        if (movedDistance < 4 && onSurfaceClickRef.current) {
          const inverted = projection.invert?.([downCanvasX, downCanvasY])
          if (inverted) {
            const [lng, lat] = inverted
            // Only fire if the click landed on the globe (not outside the disk)
            const cx = projection.translate()[0]
            const cy = projection.translate()[1]
            const insideDisk =
              Math.hypot(downCanvasX - cx, downCanvasY - cy) <=
              projection.scale()
            if (insideDisk) onSurfaceClickRef.current(lat, lng)
          }
        }

        setTimeout(() => {
          pointerActive = false
        }, 10)
      }
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
    }

    const handleWheel = (event: WheelEvent) => {
      if (!zoomEnabled) return
      event.preventDefault()
      const sf = event.deltaY > 0 ? 0.9 : 1.1
      const newRadius = Math.max(
        baseRadius * 0.5,
        Math.min(baseRadius * 3, projection.scale() * sf),
      )
      projection.scale(newRadius)
      render()
    }

    canvas.addEventListener("mousedown", handleMouseDown)
    canvas.addEventListener("wheel", handleWheel, { passive: false })

    loadWorldData()

    return () => {
      rotationTimer.stop()
      canvas.removeEventListener("mousedown", handleMouseDown)
      canvas.removeEventListener("wheel", handleWheel)
      renderRef.current = null
    }
  }, [width, height, dragEnabled, zoomEnabled, dotSpacing])

  // re-render when data or theme changes without recreating the canvas
  useEffect(() => {
    renderRef.current?.()
  }, [
    points,
    arcs,
    oceanColor,
    globeStrokeColor,
    landStyle,
    landFillColor,
    landStrokeColor,
    graticuleColor,
    graticuleOpacity,
    dotColor,
    dotSize,
    showCountryBorders,
    countryStrokeColor,
    countryStrokeOpacity,
    countryStrokeWidth,
    arcColor,
    arcOpacity,
    arcWidth,
    arcLift,
  ])

  if (error) {
    return (
      <div
        className={`dark flex items-center justify-center bg-card rounded-2xl p-8 ${className}`}
      >
        <div className="text-center">
          <p className="dark text-destructive font-semibold mb-2">
            Error loading Earth visualization
          </p>
          <p className="dark text-muted-foreground text-sm">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      <canvas
        ref={canvasRef}
        className="block rounded-2xl bg-background dark"
        style={{
          maxWidth: "100%",
          height: "auto",
          cursor: dropMode ? "crosshair" : "grab",
        }}
      />

      {/* SVG overlay: arcs below markers */}
      <svg
        className="pointer-events-none absolute inset-0"
        style={{ width: "100%", height: "100%", overflow: "visible" }}
      >
        {arcs.map((arc) => (
          <path
            key={`${arc.from}-${arc.to}`}
            ref={(el) => {
              const key = `${arc.from}-${arc.to}`
              if (el) arcPathRefs.current.set(key, el)
              else arcPathRefs.current.delete(key)
            }}
            fill="none"
            strokeLinecap="round"
          />
        ))}

        {points.map((p) => {
          const color = p.color ?? markerColor
          const isHovered = hoveredId === p.id
          return (
            <g key={p.id}>
              {/* Country shape — only filled by render() when kind === "country" with a matched feature */}
              <path
                ref={(el) => {
                  if (el) countryPathRefs.current.set(p.id, el)
                  else countryPathRefs.current.delete(p.id)
                }}
                fill={color}
                fillOpacity={isHovered ? 0.75 : 0.55}
                stroke={color}
                strokeWidth={isHovered ? 1.6 : 1.2}
                strokeOpacity={0.95}
                style={{
                  cursor: "pointer",
                  pointerEvents: "none",
                  transition: "fill-opacity 150ms ease-out, stroke-width 150ms ease-out",
                }}
                onMouseEnter={(e) => {
                  setHovered(p)
                  onMarkerHover?.(p, { x: e.clientX, y: e.clientY })
                }}
                onMouseMove={(e) => {
                  onMarkerHover?.(p, { x: e.clientX, y: e.clientY })
                }}
                onMouseLeave={() => {
                  setHovered(null)
                  onMarkerHover?.(null)
                }}
                onClick={() => onMarkerClick?.(p)}
              />

              {/* City dot — default render; also fallback when a "country" point has no matching feature */}
              <circle
                ref={(el) => {
                  if (el) markerCircleRefs.current.set(p.id, el)
                  else markerCircleRefs.current.delete(p.id)
                }}
                r={isHovered ? markerRadius * hoverScale : markerRadius}
                fill={color}
                stroke="rgba(0,0,0,0.55)"
                strokeWidth={1}
                style={{
                  cursor: "pointer",
                  transition: "r 150ms ease-out",
                  pointerEvents: "auto",
                }}
                onMouseEnter={(e) => {
                  setHovered(p)
                  onMarkerHover?.(p, { x: e.clientX, y: e.clientY })
                }}
                onMouseMove={(e) => {
                  onMarkerHover?.(p, { x: e.clientX, y: e.clientY })
                }}
                onMouseLeave={() => {
                  setHovered(null)
                  onMarkerHover?.(null)
                }}
                onClick={() => onMarkerClick?.(p)}
              />
            </g>
          )
        })}
      </svg>

      {showHint && (
        <div className="absolute bottom-4 left-4 text-xs text-muted-foreground px-2 py-1 rounded-md dark bg-neutral-900/80 backdrop-blur">
          Drag to rotate · Scroll to zoom
        </div>
      )}
    </div>
  )
}
