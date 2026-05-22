"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import RotatingEarth, {
  type Arc,
  type Point,
} from "@/components/ui/wireframe-dotted-globe"

// ─── Sample / starting data ────────────────────────────────────────────────

const INITIAL_POINTS: Point[] = [
  { id: "nyc", lat: 40.7128, lng: -74.006, label: "New York", value: 12483, color: "#facc15" },
  { id: "ldn", lat: 51.5074, lng: -0.1278, label: "London", value: 9821, color: "#facc15" },
  { id: "tyo", lat: 35.6762, lng: 139.6503, label: "Tokyo", value: 7204, color: "#facc15" },
  { id: "syd", lat: -33.8688, lng: 151.2093, label: "Sydney", value: 2103, color: "#facc15" },
  { id: "sao", lat: -23.5505, lng: -46.6333, label: "São Paulo", value: 4592, color: "#facc15" },
  { id: "cpt", lat: -33.9249, lng: 18.4241, label: "Cape Town", value: 1340, color: "#facc15" },
  { id: "bom", lat: 19.076, lng: 72.8777, label: "Mumbai", value: 8915, color: "#facc15" },
  { id: "sfo", lat: 37.7749, lng: -122.4194, label: "San Francisco", value: 6320, color: "#facc15" },
]

const INITIAL_ARCS: Arc[] = [
  { from: "nyc", to: "ldn" },
  { from: "ldn", to: "tyo" },
  { from: "tyo", to: "syd" },
  { from: "nyc", to: "sao" },
  { from: "sfo", to: "bom" },
  { from: "cpt", to: "bom" },
]

const PALETTE = [
  "#facc15", // amber
  "#ef4444", // red
  "#3b82f6", // blue
  "#10b981", // emerald
  "#a855f7", // purple
  "#f97316", // orange
  "#22d3ee", // cyan
  "#ec4899", // pink
]

// ─── Themes ────────────────────────────────────────────────────────────────

type Theme = {
  id: string
  label: string
  oceanColor: string
  globeStrokeColor: string
  landStyle: "dotted" | "filled" | "outline"
  landFillColor: string
  landStrokeColor: string
  graticuleColor: string
  graticuleOpacity: number
  dotColor: string
  showCountryBorders: boolean
  countryStrokeColor: string
  countryStrokeOpacity: number
  arcColor: string
}

const THEMES: Theme[] = [
  {
    id: "mono",
    label: "Mono",
    oceanColor: "#000000",
    globeStrokeColor: "#ffffff",
    landStyle: "dotted",
    landFillColor: "#ffffff",
    landStrokeColor: "#ffffff",
    graticuleColor: "#ffffff",
    graticuleOpacity: 0.25,
    dotColor: "#999999",
    showCountryBorders: false,
    countryStrokeColor: "#ffffff",
    countryStrokeOpacity: 0,
    arcColor: "#ffffff",
  },
  {
    id: "cyber",
    label: "Cyber",
    oceanColor: "#020617",
    globeStrokeColor: "#22d3ee",
    landStyle: "dotted",
    landFillColor: "#22d3ee",
    landStrokeColor: "#22d3ee",
    graticuleColor: "#22d3ee",
    graticuleOpacity: 0.25,
    dotColor: "#0891b2",
    showCountryBorders: false,
    countryStrokeColor: "#22d3ee",
    countryStrokeOpacity: 0,
    arcColor: "#22d3ee",
  },
  {
    id: "sunset",
    label: "Sunset",
    oceanColor: "#170914",
    globeStrokeColor: "#f9a8d4",
    landStyle: "dotted",
    landFillColor: "#fbcfe8",
    landStrokeColor: "#fbcfe8",
    graticuleColor: "#fbcfe8",
    graticuleOpacity: 0.25,
    dotColor: "#9d4f6c",
    showCountryBorders: false,
    countryStrokeColor: "#fbcfe8",
    countryStrokeOpacity: 0,
    arcColor: "#fda4af",
  },
  {
    id: "atlas",
    label: "Atlas",
    oceanColor: "#0b1422",
    globeStrokeColor: "#1f2a44",
    landStyle: "filled",
    landFillColor: "#e7e2d3",
    landStrokeColor: "#a8a08d",
    graticuleColor: "#3b4a6b",
    graticuleOpacity: 0.18,
    dotColor: "#999999",
    showCountryBorders: true,
    countryStrokeColor: "#8c8470",
    countryStrokeOpacity: 0.45,
    arcColor: "#fca5a5",
  },
  {
    id: "borders",
    label: "Borders",
    oceanColor: "#0c1117",
    globeStrokeColor: "#475569",
    landStyle: "outline",
    landFillColor: "#0c1117",
    landStrokeColor: "rgba(148,163,184,0.25)",
    graticuleColor: "#1e293b",
    graticuleOpacity: 0.35,
    dotColor: "#999999",
    showCountryBorders: true,
    countryStrokeColor: "#cbd5e1",
    countryStrokeOpacity: 0.85,
    arcColor: "#6ee7b7",
  },
]

const fmt = new Intl.NumberFormat("en-US")

const STORAGE_KEY = "globe-builder-v1"

// ─── Page (Builder UI) ─────────────────────────────────────────────────────

export default function Home() {
  const [points, setPoints] = useState<Point[]>(INITIAL_POINTS)
  const [arcs, setArcs] = useState<Arc[]>(INITIAL_ARCS)
  const [themeId, setThemeId] = useState<string>("borders")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hovered, setHovered] = useState<Point | null>(null)
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(
    null,
  )
  const [dropMode, setDropMode] = useState(false)
  const [autoRotate, setAutoRotate] = useState(true)
  const [rotateSpeed, setRotateSpeed] = useState(0.5)
  const [exportOpen, setExportOpen] = useState(false)
  const [hasHydrated, setHasHydrated] = useState(false)

  // ── Load saved state on mount (one-shot) ────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const data = JSON.parse(raw)
        if (Array.isArray(data.points)) setPoints(data.points)
        if (Array.isArray(data.arcs)) setArcs(data.arcs)
        if (typeof data.themeId === "string") setThemeId(data.themeId)
        if (typeof data.autoRotate === "boolean") setAutoRotate(data.autoRotate)
        if (typeof data.rotateSpeed === "number")
          setRotateSpeed(data.rotateSpeed)
      }
    } catch {
      /* ignore corrupted storage */
    }
    setHasHydrated(true)
  }, [])

  // ── Persist on every change (after first hydration) ─────────────────────
  useEffect(() => {
    if (!hasHydrated) return
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ points, arcs, themeId, autoRotate, rotateSpeed }),
      )
    } catch {
      /* quota / private mode */
    }
  }, [hasHydrated, points, arcs, themeId, autoRotate, rotateSpeed])

  function resetToDemo() {
    if (
      !confirm("Reset all points, arcs, and theme back to the demo defaults?")
    )
      return
    setPoints(INITIAL_POINTS)
    setArcs(INITIAL_ARCS)
    setThemeId("borders")
    setAutoRotate(true)
    setRotateSpeed(0.5)
    setSelectedId(null)
  }

  const theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0]
  const selected = useMemo(
    () => points.find((p) => p.id === selectedId) ?? null,
    [points, selectedId],
  )

  function addPoint() {
    const id = `p-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 6)}`
    const next: Point = {
      id,
      label: "New point",
      lat: 0,
      lng: 0,
      color: PALETTE[points.length % PALETTE.length],
      value: 0,
    }
    setPoints((prev) => [...prev, next])
    setSelectedId(id)
  }

  function updatePoint(id: string, patch: Partial<Point>) {
    setPoints((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    )
  }

  function deletePoint(id: string) {
    setPoints((prev) => prev.filter((p) => p.id !== id))
    setArcs((prev) => prev.filter((a) => a.from !== id && a.to !== id))
    if (selectedId === id) setSelectedId(null)
  }

  function handleSurfaceClick(lat: number, lng: number) {
    if (!dropMode) return
    const id = `p-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 6)}`
    const next: Point = {
      id,
      label: "New point",
      lat: Number(lat.toFixed(4)),
      lng: Number(lng.toFixed(4)),
      color: PALETTE[points.length % PALETTE.length],
      value: 0,
      kind: "city",
    }
    setPoints((prev) => [...prev, next])
    setSelectedId(id)
    setDropMode(false)
  }

  function connect(fromId: string, toId: string) {
    setArcs((prev) => {
      const exists = prev.some(
        (a) =>
          (a.from === fromId && a.to === toId) ||
          (a.from === toId && a.to === fromId),
      )
      if (exists) return prev
      return [...prev, { from: fromId, to: toId }]
    })
  }

  function disconnect(fromId: string, toId: string) {
    setArcs((prev) =>
      prev.filter(
        (a) =>
          !(
            (a.from === fromId && a.to === toId) ||
            (a.from === toId && a.to === fromId)
          ),
      ),
    )
  }

  return (
    <main className="flex h-dvh w-full flex-col overflow-hidden bg-background text-foreground">
      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <header className="flex h-14 items-center justify-between border-b border-border px-5">
        <div className="flex items-baseline gap-3">
          <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Globe Builder
          </span>
          <span className="text-sm text-foreground/80">
            {points.length} {points.length === 1 ? "point" : "points"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAutoRotate((v) => !v)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
              autoRotate
                ? "border-border bg-card text-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
            aria-pressed={autoRotate}
            title={autoRotate ? "Pause rotation" : "Resume rotation"}
          >
            <span aria-hidden>{autoRotate ? "⏸" : "▶"}</span>
            <span>Auto-rotate</span>
          </button>

          <div className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Speed
            </span>
            <input
              type="range"
              min={0}
              max={2}
              step={0.05}
              value={rotateSpeed}
              onChange={(e) => setRotateSpeed(parseFloat(e.target.value))}
              disabled={!autoRotate}
              className="h-1 w-24 cursor-pointer accent-foreground disabled:opacity-40"
              aria-label="Rotation speed"
            />
            <span className="w-7 text-right text-[10px] tabular-nums text-muted-foreground">
              {rotateSpeed.toFixed(2)}
            </span>
          </div>

          <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setThemeId(t.id)}
                className={`rounded-full px-3 py-1 text-xs transition-colors ${
                  themeId === t.id
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setExportOpen(true)}
            className="rounded-full border border-foreground bg-foreground px-4 py-1.5 text-xs font-medium text-background hover:bg-foreground/90"
          >
            Export ↗
          </button>
        </div>
      </header>

      {/* ── Main 3-column layout ────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: points list */}
        <aside className="flex w-64 flex-col border-r border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Points
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setDropMode((m) => !m)}
                className={`rounded-md border px-2 py-0.5 text-xs transition-colors ${
                  dropMode
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
                title="Click on the globe to drop a point"
              >
                ⌖ Drop
              </button>
              <button
                type="button"
                onClick={addPoint}
                className="rounded-md border border-border px-2 py-0.5 text-xs text-foreground hover:bg-background"
              >
                + Add
              </button>
            </div>
          </div>

          <ul className="flex-1 overflow-y-auto py-1">
            {points.length === 0 && (
              <li className="px-3 py-6 text-center text-xs text-muted-foreground">
                No points yet. Click "+ Add" to drop one.
              </li>
            )}
            {points.map((p) => {
              const isSelected = selectedId === p.id
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    className={`group flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                      isSelected
                        ? "bg-background text-foreground"
                        : "text-muted-foreground hover:bg-background/40 hover:text-foreground"
                    }`}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: p.color ?? "#facc15" }}
                    />
                    <span className="flex-1 truncate">
                      {p.label || "Untitled"}
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation()
                        deletePoint(p.id)
                      }}
                      className="rounded px-1 text-xs text-muted-foreground opacity-0 transition hover:text-destructive group-hover:opacity-100"
                      aria-label="Delete point"
                    >
                      ✕
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>

          <div className="flex items-center justify-between border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
            <span>Click a marker to edit</span>
            <button
              type="button"
              onClick={resetToDemo}
              className="underline-offset-2 hover:text-foreground hover:underline"
              title="Reset everything to the demo data"
            >
              Reset
            </button>
          </div>
        </aside>

        {/* Center: globe */}
        <section className="relative flex flex-1 items-center justify-center overflow-hidden">
          <RotatingEarth
            width={720}
            height={640}
            points={points}
            arcs={arcs}
            oceanColor={theme.oceanColor}
            globeStrokeColor={theme.globeStrokeColor}
            landStyle={theme.landStyle}
            landFillColor={theme.landFillColor}
            landStrokeColor={theme.landStrokeColor}
            graticuleColor={theme.graticuleColor}
            graticuleOpacity={theme.graticuleOpacity}
            dotColor={theme.dotColor}
            showCountryBorders={theme.showCountryBorders}
            countryStrokeColor={theme.countryStrokeColor}
            countryStrokeOpacity={theme.countryStrokeOpacity}
            markerColor="#facc15"
            arcColor={theme.arcColor}
            autoRotate={autoRotate}
            rotateSpeed={rotateSpeed}
            dropMode={dropMode}
            onSurfaceClick={handleSurfaceClick}
            onMarkerHover={(p, pos) => {
              setHovered(p)
              setHoverPos(pos ?? null)
            }}
            onMarkerClick={(p) => setSelectedId(p.id)}
          />

          {hovered && hoverPos && (
            <HoverTooltip point={hovered} pos={hoverPos} />
          )}

          {dropMode && (
            <div className="pointer-events-none absolute top-5 left-1/2 -translate-x-1/2 rounded-full border border-foreground/40 bg-foreground/90 px-3 py-1.5 text-xs text-background shadow-lg">
              Click on the globe to drop a point
              <button
                type="button"
                onClick={() => setDropMode(false)}
                className="pointer-events-auto ml-2 underline opacity-80 hover:opacity-100"
              >
                cancel
              </button>
            </div>
          )}
        </section>

        {/* Right: inspector (when a point is selected) */}
        {selected && (
          <Inspector
            key={selected.id}
            point={selected}
            allPoints={points}
            arcs={arcs}
            onUpdate={(patch) => updatePoint(selected.id, patch)}
            onDelete={() => deletePoint(selected.id)}
            onClose={() => setSelectedId(null)}
            onConnect={(toId) => connect(selected.id, toId)}
            onDisconnect={(toId) => disconnect(selected.id, toId)}
          />
        )}
      </div>

      {exportOpen && (
        <ExportModal
          points={points}
          arcs={arcs}
          theme={theme}
          autoRotate={autoRotate}
          rotateSpeed={rotateSpeed}
          onClose={() => setExportOpen(false)}
        />
      )}
    </main>
  )
}

// ─── Inspector ─────────────────────────────────────────────────────────────

function Inspector({
  point,
  allPoints,
  arcs,
  onUpdate,
  onDelete,
  onClose,
  onConnect,
  onDisconnect,
}: {
  point: Point
  allPoints: Point[]
  arcs: Arc[]
  onUpdate: (patch: Partial<Point>) => void
  onDelete: () => void
  onClose: () => void
  onConnect: (toId: string) => void
  onDisconnect: (toId: string) => void
}) {
  // Build connection / not-yet-connected lists
  const connections = arcs
    .filter((a) => a.from === point.id || a.to === point.id)
    .map((a) => {
      const otherId = a.from === point.id ? a.to : a.from
      const other = allPoints.find((p) => p.id === otherId)
      return { otherId, other, arc: a }
    })
    .filter((c): c is { otherId: string; other: Point; arc: Arc } => !!c.other)

  const candidates = allPoints.filter(
    (p) =>
      p.id !== point.id &&
      !arcs.some(
        (a) =>
          (a.from === point.id && a.to === p.id) ||
          (a.from === p.id && a.to === point.id),
      ),
  )
  return (
    <aside className="flex w-80 flex-col border-l border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Inspector
            </span>
            <span
              className={`rounded-full border px-1.5 py-px text-[9px] uppercase tracking-wider ${
                point.kind === "country"
                  ? "border-emerald-500/40 text-emerald-300"
                  : "border-border text-muted-foreground"
              }`}
            >
              {point.kind === "country" ? "Country" : "City"}
            </span>
          </div>
          <div className="mt-0.5 text-sm font-medium text-foreground">
            {point.label || "Untitled"}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-muted-foreground hover:text-foreground"
          aria-label="Close inspector"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <Field label="Search location">
          <LocationSearch
            onSelect={({ label, lat, lng, kind, countryCode }) =>
              onUpdate({ label, lat, lng, kind, countryCode })
            }
          />
        </Field>

        <Field label="Label">
          <input
            className={inputClass}
            value={point.label ?? ""}
            onChange={(e) => onUpdate({ label: e.target.value })}
            placeholder="City, country, region…"
          />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Latitude">
            <input
              type="number"
              step={0.0001}
              className={inputClass}
              value={point.lat}
              onChange={(e) => {
                const n = Number(e.target.value)
                if (!Number.isNaN(n)) onUpdate({ lat: n })
              }}
            />
          </Field>
          <Field label="Longitude">
            <input
              type="number"
              step={0.0001}
              className={inputClass}
              value={point.lng}
              onChange={(e) => {
                const n = Number(e.target.value)
                if (!Number.isNaN(n)) onUpdate({ lng: n })
              }}
            />
          </Field>
        </div>

        <Field label="Color">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onUpdate({ color: c })}
                className={`h-6 w-6 rounded-md transition ${
                  point.color === c
                    ? "ring-2 ring-foreground ring-offset-1 ring-offset-card"
                    : "hover:scale-110"
                }`}
                style={{ background: c }}
                aria-label={`Set color ${c}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={point.color ?? "#facc15"}
              onChange={(e) => onUpdate({ color: e.target.value })}
              className="h-7 w-10 cursor-pointer rounded border border-border bg-background p-0.5"
            />
            <input
              type="text"
              className={inputClass}
              value={point.color ?? ""}
              onChange={(e) => onUpdate({ color: e.target.value })}
              placeholder="#facc15"
            />
          </div>
        </Field>

        <Field label="Value">
          <input
            type="number"
            className={inputClass}
            value={point.value ?? 0}
            onChange={(e) => {
              const n = Number(e.target.value)
              if (!Number.isNaN(n)) onUpdate({ value: n })
            }}
            placeholder="0"
          />
        </Field>

        <Section title="Tooltip on hover">
          <Field label="Subtitle">
            <input
              className={inputClass}
              value={point.subtitle ?? ""}
              onChange={(e) => onUpdate({ subtitle: e.target.value })}
              placeholder="Top customer region, Office HQ…"
            />
          </Field>
          <Field label="Description">
            <textarea
              className={`${inputClass} min-h-[64px] resize-y`}
              value={point.description ?? ""}
              onChange={(e) => onUpdate({ description: e.target.value })}
              placeholder="Any text that should appear in the hover tooltip."
            />
          </Field>
          <Field label="Image URL">
            <input
              className={inputClass}
              value={point.imageUrl ?? ""}
              onChange={(e) => onUpdate({ imageUrl: e.target.value })}
              placeholder="https://…"
            />
          </Field>
          <Field label="Link URL">
            <input
              className={inputClass}
              value={point.linkUrl ?? ""}
              onChange={(e) => onUpdate({ linkUrl: e.target.value })}
              placeholder="https://…"
            />
          </Field>
        </Section>

        <Field label={`Connections (${connections.length})`}>
          {connections.length > 0 && (
            <ul className="mb-2 space-y-1">
              {connections.map(({ otherId, other }) => (
                <li
                  key={otherId}
                  className="flex items-center justify-between rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                >
                  <span className="flex items-center gap-2 truncate">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: other.color ?? "#facc15" }}
                    />
                    <span className="truncate text-foreground">
                      {other.label || "Untitled"}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onDisconnect(otherId)}
                    className="ml-2 shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label={`Disconnect ${other.label}`}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
          <select
            className={`${inputClass} cursor-pointer`}
            value=""
            onChange={(e) => {
              if (e.target.value) {
                onConnect(e.target.value)
                e.currentTarget.value = ""
              }
            }}
            disabled={candidates.length === 0}
          >
            <option value="">
              {candidates.length === 0
                ? "Already connected to all points"
                : "+ Connect to…"}
            </option>
            {candidates.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label || "Untitled"}
              </option>
            ))}
          </select>
        </Field>

        <div className="rounded-md border border-border bg-background/50 p-3 text-xs text-muted-foreground">
          <div className="font-medium text-foreground/80">Coming soon</div>
          <div className="mt-1">
            Visual hover style (ring / glow / pulse), marker icons, save /
            load, code export.
          </div>
        </div>
      </div>

      <div className="border-t border-border p-3">
        <button
          type="button"
          onClick={onDelete}
          className="w-full rounded-md border border-border py-2 text-xs text-destructive hover:bg-background"
        >
          Delete point
        </button>
      </div>
    </aside>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      {children}
    </label>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-background/30 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      {children}
    </div>
  )
}

// ─── Code generation ─────────────────────────────────────────────────────

function pruneEmpty<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {}
  for (const k in obj) {
    const v = obj[k]
    if (v === undefined || v === null || v === "" || v === 0) continue
    out[k] = v
  }
  // always keep id/lat/lng for Point and from/to for Arc — caller is responsible
  return out
}

function stringifyPretty(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

function generateReactCode({
  points,
  arcs,
  theme,
  autoRotate,
  rotateSpeed,
}: {
  points: Point[]
  arcs: Arc[]
  theme: Theme
  autoRotate: boolean
  rotateSpeed: number
}): string {
  // Strip empty optional fields from each point so the export is tidy
  const cleanPoints = points.map((p) => {
    const { id, lat, lng, ...rest } = p
    return { id, lat, lng, ...pruneEmpty(rest) }
  })

  return `"use client" // Only needed for Next.js App Router. Harmless to leave in / safe to remove elsewhere.

// Works in any React 18+ project — Next.js, Vite, CRA, Remix, Astro, Gatsby…
// Setup:
//   1. Save Step 1 (the engine) as  wireframe-dotted-globe.tsx
//   2. Save this file as            MyGlobe.tsx  in the SAME folder
//   3. npm i d3 && npm i -D @types/d3
//   4. Render <MyGlobe /> wherever you want
//
// Folder can be anywhere — src/components/, app/lib/, whatever your project uses.
// Both files just need to live next to each other so the relative import resolves.

import RotatingEarth, {
  type Arc,
  type Point,
} from "./wireframe-dotted-globe"

const points: Point[] = ${stringifyPretty(cleanPoints)}

const arcs: Arc[] = ${stringifyPretty(arcs)}

export default function MyGlobe() {
  return (
    <RotatingEarth
      width={720}
      height={640}
      points={points}
      arcs={arcs}
      autoRotate={${autoRotate}}
      rotateSpeed={${rotateSpeed}}
      oceanColor=${JSON.stringify(theme.oceanColor)}
      globeStrokeColor=${JSON.stringify(theme.globeStrokeColor)}
      landStyle=${JSON.stringify(theme.landStyle)}
      landFillColor=${JSON.stringify(theme.landFillColor)}
      landStrokeColor=${JSON.stringify(theme.landStrokeColor)}
      graticuleColor=${JSON.stringify(theme.graticuleColor)}
      graticuleOpacity={${theme.graticuleOpacity}}
      dotColor=${JSON.stringify(theme.dotColor)}
      showCountryBorders={${theme.showCountryBorders}}
      countryStrokeColor=${JSON.stringify(theme.countryStrokeColor)}
      countryStrokeOpacity={${theme.countryStrokeOpacity}}
      arcColor=${JSON.stringify(theme.arcColor)}
    />
  )
}
`
}

function generateJson({
  points,
  arcs,
  theme,
  autoRotate,
  rotateSpeed,
}: {
  points: Point[]
  arcs: Arc[]
  theme: Theme
  autoRotate: boolean
  rotateSpeed: number
}): string {
  return stringifyPretty({
    points,
    arcs,
    theme,
    autoRotate,
    rotateSpeed,
  })
}

function generateFramerWrapper({
  points,
  arcs,
  theme,
  autoRotate,
  rotateSpeed,
}: {
  points: Point[]
  arcs: Arc[]
  theme: Theme
  autoRotate: boolean
  rotateSpeed: number
}): string {
  const cleanPoints = points.map((p) => {
    const { id, lat, lng, ...rest } = p
    return { id, lat, lng, ...pruneEmpty(rest) }
  })

  const q = (v: string) => JSON.stringify(v)

  return `// Globe Builder — Framer Code Component
// Paste this as a new Code File in Framer (alongside wireframe-dotted-globe.tsx — see Step 1)

import RotatingEarth, {
    type Arc,
    type Point,
} from "./wireframe-dotted-globe"
import { addPropertyControls, ControlType } from "framer"

const DEFAULT_POINTS: Point[] = ${stringifyPretty(cleanPoints)}

const DEFAULT_ARCS: Arc[] = ${stringifyPretty(arcs)}

/**
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 */
export default function Globe(props: any) {
    return (
        <RotatingEarth
            width={props.width}
            height={props.height}
            points={props.points}
            arcs={props.arcs}
            autoRotate={props.autoRotate}
            rotateSpeed={props.rotateSpeed}
            oceanColor={props.oceanColor}
            globeStrokeColor={props.globeStrokeColor}
            landStyle={props.landStyle}
            landFillColor={props.landFillColor}
            landStrokeColor={props.landStrokeColor}
            graticuleColor={props.graticuleColor}
            graticuleOpacity={props.graticuleOpacity}
            dotColor={props.dotColor}
            showCountryBorders={props.showCountryBorders}
            countryStrokeColor={props.countryStrokeColor}
            countryStrokeOpacity={props.countryStrokeOpacity}
            arcColor={props.arcColor}
        />
    )
}

Globe.defaultProps = {
    width: 800,
    height: 600,
    points: DEFAULT_POINTS,
    arcs: DEFAULT_ARCS,
    autoRotate: ${autoRotate},
    rotateSpeed: ${rotateSpeed},
    oceanColor: ${q(theme.oceanColor)},
    globeStrokeColor: ${q(theme.globeStrokeColor)},
    landStyle: ${q(theme.landStyle)},
    landFillColor: ${q(theme.landFillColor)},
    landStrokeColor: ${q(theme.landStrokeColor)},
    graticuleColor: ${q(theme.graticuleColor)},
    graticuleOpacity: ${theme.graticuleOpacity},
    dotColor: ${q(theme.dotColor)},
    showCountryBorders: ${theme.showCountryBorders},
    countryStrokeColor: ${q(theme.countryStrokeColor)},
    countryStrokeOpacity: ${theme.countryStrokeOpacity},
    arcColor: ${q(theme.arcColor)},
}

addPropertyControls(Globe, {
    // ── Appearance ──────────────────────────────────────────────────────
    oceanColor: {
        type: ControlType.Color,
        title: "Ocean",
        defaultValue: ${q(theme.oceanColor)},
    },
    globeStrokeColor: {
        type: ControlType.Color,
        title: "Globe outline",
        defaultValue: ${q(theme.globeStrokeColor)},
    },
    landStyle: {
        type: ControlType.Enum,
        title: "Land style",
        options: ["dotted", "filled", "outline"],
        optionTitles: ["Dotted", "Filled", "Outline"],
        defaultValue: ${q(theme.landStyle)},
    },
    landFillColor: {
        type: ControlType.Color,
        title: "Land fill",
        defaultValue: ${q(theme.landFillColor)},
        hidden: (p: any) => p.landStyle !== "filled",
    },
    landStrokeColor: {
        type: ControlType.Color,
        title: "Land outline",
        defaultValue: ${q(theme.landStrokeColor)},
    },
    graticuleColor: {
        type: ControlType.Color,
        title: "Graticule",
        defaultValue: ${q(theme.graticuleColor)},
    },
    graticuleOpacity: {
        type: ControlType.Number,
        title: "Graticule opacity",
        min: 0,
        max: 1,
        step: 0.05,
        defaultValue: ${theme.graticuleOpacity},
    },
    dotColor: {
        type: ControlType.Color,
        title: "Halftone dots",
        defaultValue: ${q(theme.dotColor)},
        hidden: (p: any) => p.landStyle !== "dotted",
    },
    showCountryBorders: {
        type: ControlType.Boolean,
        title: "Country borders",
        defaultValue: ${theme.showCountryBorders},
    },
    countryStrokeColor: {
        type: ControlType.Color,
        title: "Border color",
        defaultValue: ${q(theme.countryStrokeColor)},
        hidden: (p: any) => !p.showCountryBorders,
    },
    countryStrokeOpacity: {
        type: ControlType.Number,
        title: "Border opacity",
        min: 0,
        max: 1,
        step: 0.05,
        defaultValue: ${theme.countryStrokeOpacity},
        hidden: (p: any) => !p.showCountryBorders,
    },
    arcColor: {
        type: ControlType.Color,
        title: "Arc color",
        defaultValue: ${q(theme.arcColor)},
    },

    // ── Motion ──────────────────────────────────────────────────────────
    autoRotate: {
        type: ControlType.Boolean,
        title: "Auto-rotate",
        defaultValue: ${autoRotate},
    },
    rotateSpeed: {
        type: ControlType.Number,
        title: "Rotate speed",
        min: 0,
        max: 2,
        step: 0.05,
        defaultValue: ${rotateSpeed},
        hidden: (p: any) => !p.autoRotate,
    },

    // ── Data ────────────────────────────────────────────────────────────
    points: {
        type: ControlType.Array,
        title: "Points",
        control: {
            type: ControlType.Object,
            controls: {
                id: { type: ControlType.String, title: "ID" },
                label: { type: ControlType.String, title: "Label" },
                lat: {
                    type: ControlType.Number,
                    title: "Latitude",
                    min: -90,
                    max: 90,
                    step: 0.0001,
                },
                lng: {
                    type: ControlType.Number,
                    title: "Longitude",
                    min: -180,
                    max: 180,
                    step: 0.0001,
                },
                color: {
                    type: ControlType.Color,
                    title: "Color",
                    defaultValue: "#facc15",
                },
                value: { type: ControlType.Number, title: "Value" },
                kind: {
                    type: ControlType.Enum,
                    title: "Kind",
                    options: ["city", "country"],
                    optionTitles: ["City (dot)", "Country (filled)"],
                    defaultValue: "city",
                },
                countryCode: {
                    type: ControlType.String,
                    title: "Country code (ISO-2)",
                    hidden: (p: any) => p.kind !== "country",
                },
                subtitle: { type: ControlType.String, title: "Subtitle" },
                description: {
                    type: ControlType.String,
                    title: "Description",
                    displayTextArea: true,
                },
                imageUrl: { type: ControlType.String, title: "Image URL" },
                linkUrl: { type: ControlType.String, title: "Link URL" },
            },
        },
    },
    arcs: {
        type: ControlType.Array,
        title: "Arcs",
        control: {
            type: ControlType.Object,
            controls: {
                from: { type: ControlType.String, title: "From (point ID)" },
                to: { type: ControlType.String, title: "To (point ID)" },
                color: { type: ControlType.Color, title: "Color" },
            },
        },
    },
})
`
}

// ─── Export modal ────────────────────────────────────────────────────────

function ExportModal({
  points,
  arcs,
  theme,
  autoRotate,
  rotateSpeed,
  onClose,
}: {
  points: Point[]
  arcs: Arc[]
  theme: Theme
  autoRotate: boolean
  rotateSpeed: number
  onClose: () => void
}) {
  const [tab, setTab] = useState<"react" | "framer" | "json">("react")
  const [step, setStep] = useState<"engine" | "wrapper">("wrapper")
  const [engineSource, setEngineSource] = useState<string | null>(null)
  const [engineError, setEngineError] = useState(false)
  const [copied, setCopied] = useState(false)

  const usesSteps = tab === "react" || tab === "framer"

  // Lazy-fetch the engine source the first time either tab needs it
  useEffect(() => {
    if (!usesSteps || step !== "engine") return
    if (engineSource !== null || engineError) return
    fetch("/api/component-source")
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status))
        return r.text()
      })
      .then((text) => setEngineSource(text))
      .catch(() => setEngineError(true))
  }, [usesSteps, step, engineSource, engineError])

  const reactCode = generateReactCode({
    points,
    arcs,
    theme,
    autoRotate,
    rotateSpeed,
  })
  const jsonCode = generateJson({
    points,
    arcs,
    theme,
    autoRotate,
    rotateSpeed,
  })
  const framerWrapper = generateFramerWrapper({
    points,
    arcs,
    theme,
    autoRotate,
    rotateSpeed,
  })

  let code = ""
  let filename = ""
  let mime = "text/plain"
  if (tab === "json") {
    code = jsonCode
    filename = "globe-data.json"
    mime = "application/json"
  } else if (step === "engine") {
    code = engineSource ?? "// loading engine source…"
    filename = "wireframe-dotted-globe.tsx"
    mime = "text/typescript"
  } else if (tab === "react") {
    code = reactCode
    filename = "MyGlobe.tsx"
    mime = "text/typescript"
  } else {
    // tab === "framer" && step === "wrapper"
    code = framerWrapper
    filename = "Globe.tsx"
    mime = "text/typescript"
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked */
    }
  }

  function handleDownload() {
    const blob = new Blob([code], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-6"
      onClick={onClose}
    >
      <div
        className="flex h-full max-h-[680px] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Export
            </div>
            <div className="mt-0.5 text-base font-medium text-foreground">
              Take your globe with you
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted-foreground hover:text-foreground"
            aria-label="Close export"
          >
            ✕
          </button>
        </header>

        <div className="flex items-center justify-between border-b border-border px-5 py-2">
          <div className="flex items-center gap-1 rounded-full border border-border bg-background p-1">
            <button
              type="button"
              onClick={() => setTab("react")}
              className={`rounded-full px-3 py-1 text-xs ${
                tab === "react"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              React / Next.js
            </button>
            <button
              type="button"
              onClick={() => setTab("framer")}
              className={`rounded-full px-3 py-1 text-xs ${
                tab === "framer"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Framer
            </button>
            <button
              type="button"
              onClick={() => setTab("json")}
              className={`rounded-full px-3 py-1 text-xs ${
                tab === "json"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              JSON data
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              className="rounded-md border border-border px-3 py-1 text-xs text-foreground hover:bg-background"
            >
              Download
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-md border border-foreground bg-foreground px-3 py-1 text-xs font-medium text-background hover:bg-foreground/90"
            >
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>
        </div>

        {usesSteps && (
          <div className="flex items-center gap-2 border-b border-border bg-background/40 px-5 py-2">
            <button
              type="button"
              onClick={() => setStep("engine")}
              className={`rounded-md px-3 py-1 text-xs ${
                step === "engine"
                  ? "bg-card text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              1. Engine ({" "}
              <code className="text-[10px]">wireframe-dotted-globe.tsx</code> )
            </button>
            <span className="text-muted-foreground">→</span>
            <button
              type="button"
              onClick={() => setStep("wrapper")}
              className={`rounded-md px-3 py-1 text-xs ${
                step === "wrapper"
                  ? "bg-card text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              2. Wrapper ({" "}
              <code className="text-[10px]">
                {tab === "react" ? "MyGlobe.tsx" : "Globe.tsx"}
              </code>{" "}
              )
            </button>
            {step === "engine" && engineError && (
              <span className="ml-auto text-[10px] text-destructive">
                Couldn&apos;t read engine source
              </span>
            )}
          </div>
        )}

        <pre className="flex-1 overflow-auto whitespace-pre rounded-none bg-background/60 p-4 font-mono text-[11px] leading-relaxed text-foreground/90">
          <code>{code}</code>
        </pre>

        {tab === "react" && (
          <footer className="border-t border-border bg-background/40 px-5 py-3 text-[11px] text-muted-foreground">
            Save Step 1 as{" "}
            <code className="rounded bg-card px-1 py-0.5 text-foreground/80">
              wireframe-dotted-globe.tsx
            </code>{" "}
            and Step 2 as{" "}
            <code className="rounded bg-card px-1 py-0.5 text-foreground/80">
              MyGlobe.tsx
            </code>{" "}
            in the same folder. Install{" "}
            <code className="text-foreground/80">d3</code>, then render{" "}
            <code className="text-foreground/80">{`<MyGlobe />`}</code>. Works
            in any React 18+ project — Next.js, Vite, CRA, Remix, Astro.
          </footer>
        )}

        {tab === "framer" && (
          <footer className="border-t border-border bg-background/40 px-5 py-3 text-[11px] text-muted-foreground">
            In Framer: open your project → Assets → Code → New File. Create{" "}
            <code className="text-foreground/80">
              wireframe-dotted-globe.tsx
            </code>{" "}
            and paste Step 1, then create{" "}
            <code className="text-foreground/80">Globe.tsx</code> and paste Step
            2. Drag <code className="text-foreground/80">{`<Globe />`}</code>{" "}
            onto the canvas — every prop is in the right panel.
          </footer>
        )}
      </div>
    </div>
  )
}

// ─── Rich hover tooltip (follows cursor near the marker) ──────────────────

function HoverTooltip({
  point,
  pos,
}: {
  point: Point
  pos: { x: number; y: number }
}) {
  const hasAny =
    !!point.subtitle ||
    !!point.description ||
    !!point.imageUrl ||
    !!point.linkUrl ||
    typeof point.value === "number"

  return (
    <div
      className="pointer-events-none fixed z-50 w-64 -translate-y-full rounded-lg border border-border bg-card shadow-2xl"
      style={{ left: pos.x + 14, top: pos.y - 14 }}
    >
      {point.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={point.imageUrl}
          alt={point.label ?? ""}
          className="h-28 w-full rounded-t-lg object-cover"
        />
      )}

      <div className="p-3">
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: point.color ?? "#facc15" }}
          />
          <span className="truncate text-sm font-semibold text-foreground">
            {point.label || "Untitled"}
          </span>
          {point.kind === "country" && (
            <span className="ml-auto rounded-full border border-emerald-500/40 px-1.5 py-px text-[9px] uppercase tracking-wider text-emerald-300">
              Country
            </span>
          )}
        </div>

        {point.subtitle && (
          <div className="mt-0.5 text-xs text-muted-foreground">
            {point.subtitle}
          </div>
        )}

        {typeof point.value === "number" && point.value !== 0 && (
          <div className="mt-2 text-lg font-semibold tabular-nums text-foreground">
            {fmt.format(point.value)}
          </div>
        )}

        {point.description && (
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {point.description}
          </p>
        )}

        {point.linkUrl && (
          <div className="pointer-events-auto mt-3">
            <a
              href={point.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-background"
            >
              Open link <span aria-hidden>→</span>
            </a>
          </div>
        )}

        {!hasAny && (
          <div className="mt-1 text-[10px] text-muted-foreground/70">
            {point.lat.toFixed(2)}°, {point.lng.toFixed(2)}°
          </div>
        )}
      </div>
    </div>
  )
}

const inputClass =
  "w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring"

// ─── Location search (OpenStreetMap Nominatim) ────────────────────────────

type NominatimResult = {
  place_id: number
  lat: string
  lon: string
  display_name: string
  type?: string
  class?: string
  addresstype?: string
  address?: {
    country?: string
    country_code?: string
  }
}

function LocationSearch({
  onSelect,
}: {
  onSelect: (r: {
    label: string
    lat: number
    lng: number
    kind: "city" | "country"
    countryCode?: string
  }) => void
}) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<NominatimResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      abortRef.current?.abort()
    }
  }, [])

  function onChange(value: string) {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    abortRef.current?.abort()
    const trimmed = value.trim()
    if (trimmed.length < 2) {
      setResults([])
      setOpen(false)
      setLoading(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      const controller = new AbortController()
      abortRef.current = controller
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          trimmed,
        )}&format=json&limit=5&addressdetails=1`
        const res = await fetch(url, {
          headers: { "Accept-Language": "en" },
          signal: controller.signal,
        })
        if (!res.ok) throw new Error(`Nominatim ${res.status}`)
        const data: NominatimResult[] = await res.json()
        setResults(data)
        setOpen(true)
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setResults([])
        }
      } finally {
        setLoading(false)
      }
    }, 400)
  }

  function pick(r: NominatimResult) {
    const isCountry =
      r.addresstype === "country" ||
      (r.class === "boundary" &&
        r.type === "administrative" &&
        !!r.address?.country &&
        r.display_name.trim() === r.address.country.trim())
    const countryCode = r.address?.country_code
      ? r.address.country_code.toUpperCase()
      : undefined
    const primary = r.display_name.split(",")[0]?.trim() || r.display_name
    const label = isCountry
      ? r.address?.country ?? primary
      : primary
    onSelect({
      label,
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      kind: isCountry ? "country" : "city",
      countryCode: isCountry ? countryCode : undefined,
    })
    setQuery("")
    setResults([])
    setOpen(false)
  }

  return (
    <div className="relative">
      <input
        type="text"
        className={inputClass}
        value={query}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search city, country, place…"
      />
      {loading && (
        <div className="absolute right-2.5 top-1.5 text-xs text-muted-foreground">
          …
        </div>
      )}

      {open && results.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-card shadow-lg">
          {results.map((r) => {
            const primary = r.display_name.split(",")[0]?.trim() ?? ""
            return (
              <li key={r.place_id}>
                <button
                  type="button"
                  // prevent input blur (which would close the list) until click fires
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(r)}
                  className="block w-full px-3 py-2 text-left text-xs hover:bg-background"
                >
                  <div className="font-medium text-foreground">{primary}</div>
                  <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
                    {r.display_name}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {open && !loading && query.trim().length >= 2 && results.length === 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground shadow-lg">
          No matches
        </div>
      )}
    </div>
  )
}
