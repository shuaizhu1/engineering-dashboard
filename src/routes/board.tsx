import { useMemo, useState } from 'react'
import { Link, useLocation, useParams, useRouteError } from 'react-router'
import { appConfig } from '../config'
import { DATA_DIR } from '../data/boards'
import type { Unit } from '../data/types'
import { BoardViewer } from '../detail/BoardViewer'
import { stationHistory } from '../detail/history'
import { FULL_VIEW, focusBox, type View } from '../detail/viewport'
import { filterUnits } from '../filters/filters'
import { neighbors } from '../filters/navigation'
import { useFilters } from '../hooks/useFilters'
import { ErrorPanel } from './root'
import { useLineData } from './root-data'

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })

const th = 'px-2 py-1.5 text-left font-medium text-muted'
const td = 'px-2 py-1.5'

function ResultBadge({ result }: { result: Unit['result'] }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-sm">
      <span aria-hidden="true" className="size-2 rounded-full" style={{ background: appConfig.resultColors[result] }} />
      {appConfig.results[result]}
    </span>
  )
}

/** Board detail: the inspection image with its defects, plus the station's recent results. */
export function Component() {
  const { serial = '' } = useParams()
  const { search } = useLocation()
  const { units, defects } = useLineData()
  const [filters] = useFilters()

  const unit = units.find((u) => u.serial === serial)
  // Previous/next follow the dashboard's filtered list, so stepping stays within the results.
  const matching = useMemo(() => filterUnits(units, defects, filters), [units, defects, filters])
  const position = neighbors(matching, (u) => u.serial === serial)
  const boardDefects = useMemo(() => defects.filter((d) => d.serial === serial), [defects, serial])
  const history = useMemo(() => (unit ? stationHistory(units, unit) : []), [units, unit])

  const [view, setView] = useState<View>(FULL_VIEW)
  const [highlighted, setHighlighted] = useState<number | null>(null)
  // Reset zoom and highlight when stepping to another board.
  const [shownSerial, setShownSerial] = useState(serial)
  if (shownSerial !== serial) {
    setShownSerial(serial)
    setView(FULL_VIEW)
    setHighlighted(null)
  }

  const backLink = (
    <Link to={{ pathname: '/', search }} className="text-sm">
      ← Back to results
    </Link>
  )

  if (!unit) {
    return (
      <div className="space-y-3">
        <title>{`Board not found · ${appConfig.title}`}</title>
        {backLink}
        <h1 className="text-xl font-semibold">Board {serial} not found</h1>
        <p className="text-sm text-muted">There's no inspected board with this serial number in the dataset.</p>
      </div>
    )
  }

  const imageSrc = `${DATA_DIR}/images/${unit.imageId}.webp`
  const referenceSrc = unit.imageId.endsWith('_test')
    ? `${DATA_DIR}/images/${unit.imageId.replace(/_test$/, '_temp')}.webp`
    : null
  const historyFails = history.filter((u) => u.result === 'fail').length
  const link = (u: Unit) => ({ pathname: `/units/${u.serial}`, search })

  return (
    <div className="space-y-4">
      <title>{`${unit.serial} · ${appConfig.title}`}</title>
      <nav aria-label="Board navigation" className="flex flex-wrap items-center gap-4">
        {backLink}
        <span className="ml-auto flex items-center gap-3 text-sm">
          {position.index === -1 ? (
            <span className="text-muted">Not in the current results</span>
          ) : (
            <span className="text-muted tabular-nums">
              {position.index + 1} of {matching.length.toLocaleString()}
            </span>
          )}
          {position.prev ? <Link to={link(position.prev)}>← Previous</Link> : <span className="text-muted">← Previous</span>}
          {position.next ? <Link to={link(position.next)}>Next →</Link> : <span className="text-muted">Next →</span>}
        </span>
      </nav>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-xl font-semibold">{unit.serial}</h1>
        <ResultBadge result={unit.result} />
        <p className="text-sm text-muted">
          {appConfig.lines[unit.line]} · {appConfig.stations[unit.station]} · {dateFormat.format(unit.inspectedAt)} UTC
        </p>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <BoardViewer
          imageSrc={imageSrc}
          referenceSrc={referenceSrc}
          defects={boardDefects}
          view={view}
          onViewChange={setView}
          highlighted={highlighted}
          onHighlight={setHighlighted}
        />

        <div className="space-y-4">
          <section className="rounded-lg border border-border bg-surface p-4">
            <h2 className="mb-2 text-sm font-semibold">
              Defects <span className="font-normal text-muted">({boardDefects.length})</span>
            </h2>
            {boardDefects.length === 0 ? (
              <p className="text-sm text-muted">No defects found. This board passed inspection.</p>
            ) : (
              <table className="w-full text-sm">
                <caption className="sr-only">Defects on this board</caption>
                <thead>
                  <tr className="border-b border-border">
                    <th scope="col" className={th}>#</th>
                    <th scope="col" className={th}>Type</th>
                    <th scope="col" className={`${th} text-right`}>Size (px)</th>
                    <th scope="col" className={th}>
                      <span className="sr-only">Zoom</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {boardDefects.map((d, i) => (
                    <tr
                      key={i}
                      className={`border-b border-border last:border-0 ${highlighted === i ? 'bg-border/40' : ''}`}
                      onPointerEnter={() => setHighlighted(i)}
                      onPointerLeave={() => setHighlighted(null)}
                    >
                      <td className={`${td} tabular-nums`}>{i + 1}</td>
                      <td className={td}>
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            aria-hidden="true"
                            className="size-2.5 rounded-sm"
                            style={{ background: appConfig.defectColors[d.type] }}
                          />
                          {appConfig.defectTypes[d.type]}
                        </span>
                      </td>
                      <td className={`${td} text-right tabular-nums`}>
                        {d.x2 - d.x1} × {d.y2 - d.y1}
                      </td>
                      <td className={`${td} text-right`}>
                        <button
                          type="button"
                          className="text-accent hover:underline"
                          aria-label={`Zoom to defect ${i + 1}, ${appConfig.defectTypes[d.type]}`}
                          onFocus={() => setHighlighted(i)}
                          onBlur={() => setHighlighted(null)}
                          onClick={() => setView(focusBox(d))}
                        >
                          Zoom
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="rounded-lg border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold">Station history</h2>
            <p className="mt-1 text-sm text-muted">
              {history.length === 1
                ? `This is the first board inspected at ${appConfig.lines[unit.line]} · ${appConfig.stations[unit.station]}.`
                : `${historyFails} of the last ${history.length} boards at ${appConfig.lines[unit.line]} · ${appConfig.stations[unit.station]} failed.`}
            </p>
            <ol className="mt-3 flex flex-wrap gap-1" aria-label="Recent boards at this station, oldest first">
              {history.map((u) => {
                const current = u.serial === unit.serial
                const label = `${u.serial}, ${appConfig.results[u.result]}, ${dateFormat.format(u.inspectedAt)}`
                return (
                  <li key={u.serial}>
                    <Link
                      to={link(u)}
                      title={label}
                      aria-label={current ? `${label} (this board)` : label}
                      aria-current={current ? 'page' : undefined}
                      className={`block size-5 rounded-sm ${current ? 'ring-2 ring-text ring-offset-1 ring-offset-surface' : ''}`}
                      style={{ background: appConfig.resultColors[u.result] }}
                    />
                  </li>
                )
              })}
            </ol>
            <p className="mt-2 text-xs text-muted">Oldest on the left; this board is outlined.</p>
          </section>
        </div>
      </div>
    </div>
  )
}

export function ErrorBoundary() {
  return <ErrorPanel title="This board couldn't be shown" error={useRouteError()} />
}
