import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { appConfig } from '../config'
import type { Defect } from '../data/types'
import { FULL_VIEW, IMAGE_SIZE, focusBox, panBy, toImagePoint, zoomAt, zoomLevel, type View } from './viewport'

interface BoardViewerProps {
  imageSrc: string
  /** Defect-free template of the same board area; enables the side-by-side comparison. */
  referenceSrc: string | null
  defects: Defect[]
  view: View
  onViewChange: Dispatch<SetStateAction<View>>
  /** Index into `defects` of the box to emphasize (hovered here or in the defect list). */
  highlighted: number | null
  onHighlight: (index: number | null) => void
}

const WHEEL_ZOOM = 1.15
const BUTTON_ZOOM = 1.5

const toolButton =
  'rounded border border-border px-2 py-1 text-sm hover:border-muted disabled:opacity-40 disabled:hover:border-border'

/**
 * Board image with defect boxes. Wheel or buttons zoom, dragging pans, and the keyboard does both
 * (+/− zoom, arrows pan, 0 resets). With the reference shown, both images share one view.
 */
export function BoardViewer({
  imageSrc,
  referenceSrc,
  defects,
  view,
  onViewChange,
  highlighted,
  onHighlight,
}: BoardViewerProps) {
  const [compare, setCompare] = useState(false)
  const level = zoomLevel(view)

  return (
    <section className="space-y-2 rounded-lg border border-border bg-surface p-4" aria-label="Board image">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-sm font-semibold">Board image</h2>
        <button
          type="button"
          className={toolButton}
          onClick={() => onViewChange((v) => zoomAt(v, 1 / BUTTON_ZOOM))}
          disabled={level <= 1}
          aria-label="Zoom out"
        >
          −
        </button>
        <span className="w-12 text-center text-sm tabular-nums text-muted" aria-live="polite">
          {Math.round(level * 100)}%
        </span>
        <button
          type="button"
          className={toolButton}
          onClick={() => onViewChange((v) => zoomAt(v, BUTTON_ZOOM))}
          disabled={level >= 8}
          aria-label="Zoom in"
        >
          +
        </button>
        <button type="button" className={toolButton} onClick={() => onViewChange(FULL_VIEW)} disabled={level === 1}>
          Fit
        </button>
        {referenceSrc && (
          <button type="button" className={toolButton} aria-pressed={compare} onClick={() => setCompare((c) => !c)}>
            {compare ? 'Hide reference' : 'Compare with reference'}
          </button>
        )}
      </div>
      <div className={compare && referenceSrc ? 'grid grid-cols-2 gap-2' : ''}>
        <ImagePane
          label="Inspected board"
          src={imageSrc}
          defects={defects}
          view={view}
          onViewChange={onViewChange}
          highlighted={highlighted}
          onHighlight={onHighlight}
          caption={compare ? 'Inspected' : undefined}
        />
        {compare && referenceSrc && (
          <ImagePane
            label="Defect-free reference"
            src={referenceSrc}
            defects={defects}
            view={view}
            onViewChange={onViewChange}
            highlighted={highlighted}
            onHighlight={onHighlight}
            caption="Reference"
            ghostBoxes
          />
        )}
      </div>
      <p className="text-xs text-muted">Scroll or use +/− to zoom, drag or use the arrow keys to pan, 0 to fit.</p>
    </section>
  )
}

interface ImagePaneProps extends Omit<BoardViewerProps, 'imageSrc' | 'referenceSrc'> {
  label: string
  src: string
  caption?: string
  /** Dashed outlines only: on the reference they mark where the defects are on the inspected board. */
  ghostBoxes?: boolean
}

function ImagePane({ label, src, defects, view, onViewChange, highlighted, onHighlight, caption, ghostBoxes }: ImagePaneProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<{ x: number; y: number; view: View; moved: boolean } | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [renderedSize, setRenderedSize] = useState(IMAGE_SIZE)

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const observer = new ResizeObserver(([entry]) => setRenderedSize(entry.contentRect.width || IMAGE_SIZE))
    observer.observe(svg)
    return () => observer.disconnect()
  }, [])

  // React's wheel listener is passive, so it can't stop the page from scrolling while zooming.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = svg.getBoundingClientRect()
      const factor = e.deltaY < 0 ? WHEEL_ZOOM : 1 / WHEEL_ZOOM
      onViewChange((v) => zoomAt(v, factor, toImagePoint(v, e.clientX - rect.left, e.clientY - rect.top, rect.width)))
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [onViewChange])

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = view.size / 8
    const actions: Record<string, () => View> = {
      '+': () => zoomAt(view, BUTTON_ZOOM),
      '=': () => zoomAt(view, BUTTON_ZOOM),
      '-': () => zoomAt(view, 1 / BUTTON_ZOOM),
      '0': () => FULL_VIEW,
      ArrowLeft: () => panBy(view, -step, 0),
      ArrowRight: () => panBy(view, step, 0),
      ArrowUp: () => panBy(view, 0, -step),
      ArrowDown: () => panBy(view, 0, step),
    }
    const action = actions[e.key]
    if (!action) return
    e.preventDefault()
    onViewChange(action())
  }

  // Labels and strokes keep the same on-screen size at any zoom.
  const unitsPerPx = view.size / renderedSize
  const fontSize = 12 * unitsPerPx

  return (
    <figure className="relative">
      <svg
        ref={svgRef}
        viewBox={`${view.x} ${view.y} ${view.size} ${view.size}`}
        role="group"
        aria-label={`${label}, ${defects.length} defects marked. Zoom with plus and minus, pan with the arrow keys.`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={(e) => {
          if (e.button !== 0) return
          drag.current = { x: e.clientX, y: e.clientY, view, moved: false }
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          const start = drag.current
          if (!start) return
          const scale = start.view.size / e.currentTarget.getBoundingClientRect().width
          const dx = e.clientX - start.x
          const dy = e.clientY - start.y
          if (Math.abs(dx) + Math.abs(dy) > 3) start.moved = true
          onViewChange(panBy(start.view, -dx * scale, -dy * scale))
        }}
        onPointerUp={() => {
          drag.current = null
        }}
        className={`block aspect-square w-full touch-none select-none rounded bg-border/30 ${
          view.size < IMAGE_SIZE ? 'cursor-grab active:cursor-grabbing' : ''
        }`}
      >
        <image
          href={src}
          width={IMAGE_SIZE}
          height={IMAGE_SIZE}
          // Zoomed in, show the inspection pixels as they are rather than smoothed.
          style={{ imageRendering: zoomLevel(view) >= 3 ? 'pixelated' : 'auto' }}
          onLoad={() => setStatus('ready')}
          onError={() => setStatus('error')}
        />
        {status === 'ready' &&
          defects.map((d, i) => {
            const color = appConfig.defectColors[d.type]
            const active = highlighted === i
            return (
              <g
                key={i}
                className="cursor-pointer"
                onPointerEnter={() => onHighlight(i)}
                onPointerLeave={() => onHighlight(null)}
                onClick={() => {
                  if (!drag.current?.moved) onViewChange(focusBox(d))
                }}
              >
                <title>{`${i + 1} · ${appConfig.defectTypes[d.type]}`}</title>
                <rect
                  x={d.x1}
                  y={d.y1}
                  width={d.x2 - d.x1}
                  height={d.y2 - d.y1}
                  fill={color}
                  fillOpacity={ghostBoxes ? 0 : active ? 0.25 : 0.08}
                  stroke={color}
                  strokeWidth={active ? 3.5 : 2}
                  strokeDasharray={ghostBoxes ? '4 3' : undefined}
                  vectorEffect="non-scaling-stroke"
                />
                {!ghostBoxes && (
                  <text
                    x={d.x1}
                    y={d.y1 - 3 * unitsPerPx}
                    fontSize={fontSize}
                    fontWeight={600}
                    fill={color}
                    stroke="white"
                    strokeWidth={3 * unitsPerPx}
                    paintOrder="stroke"
                  >
                    {i + 1}
                  </text>
                )}
              </g>
            )
          })}
      </svg>
      {status !== 'ready' && (
        <div
          role={status === 'error' ? 'alert' : 'status'}
          className={`pointer-events-none absolute inset-0 flex items-center justify-center rounded text-sm text-muted ${
            status === 'loading' ? 'animate-pulse' : ''
          }`}
        >
          {status === 'loading' ? 'Loading image…' : "The board image couldn't be loaded."}
        </div>
      )}
      {caption && <figcaption className="mt-1 text-center text-xs text-muted">{caption}</figcaption>}
    </figure>
  )
}
