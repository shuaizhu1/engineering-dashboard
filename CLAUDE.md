# Engineering Data Explorer – Project Context

Portfolio project for frontend job applications, mainly **Sift** (telemetry for hardware teams) and **Instrumental** (AI for electronics manufacturing). One shared core for exploring large time-based engineering data, with a thin "mode" per company.

Full requirements and phased plan (Claude Docs): https://claude.ai/code/artifact/77023540-0de2-437c-ab54-f4e5cc36ee27

## Goal and demo story

A user should be able to, in about 60 seconds:
1. See a metric over time and spot a problem (yield dip / telemetry anomaly).
2. Brush or click the chart to filter to that window.
3. See which category spiked in a breakdown (Pareto) chart and click it to filter.
4. Open a record and inspect the detail (board image with defect boxes / synced channel plots).

## Modes

- **Sift mode – flight telemetry** (build first): real PX4 drone flight logs. Rule-based anomaly detection (battery sag, vibration spikes) stored as an events table. Detail view = several channels plotted in sync around an event.
- **Instrumental mode – assembly line** ("Line Inspector"): public PCB defect image dataset (DeepPCB or a Kaggle PCB set) + synthetic unit metadata (serial, line L1–L3, station, timestamp, pass/fail, defects) with a planted defect spike. Detail view = board image with SVG defect boxes, zoom and pan, station history.
- All mode-specific settings (dataset, labels, colors, detail view) live in one config file per mode. Open a mode with `?mode=sift` or `?mode=instrumental`.

## Tech decisions (already made)

- **Vite + React + TypeScript (strict)**. No Next.js.
- **React Router** data router (`createBrowserRouter`):
  - `/` dashboard; all filters in the query string via `useSearchParams` + a typed parse/serialize helper
  - `/units/:serial` (or event detail) lazy-loaded with the route `lazy` option; preserve the query string for "back to results"
  - `*` not-found; root `errorElement`; root `loader` fetches data once
  - Vercel SPA rewrite (`vercel.json`: `/(.*)` → `/index.html`) so deep links work
- **Apache ECharts** (canvas renderer) for charts:
  - Tree-shaken imports from `echarts/core`
  - Own `<EChart option onEvents />` wrapper: init in `useEffect`, `setOption`, `ResizeObserver`, `dispose`
  - Options built in pure, unit-tested functions (e.g. `buildYieldOption(data, filters)`)
  - `dataZoom` + `brush` (`brushEnd` → date filter, `replace` history), `markArea` for the active range, `click` on Pareto bars, `sampling: 'lttb'`, `dataset.source` arrays, `aria: { enabled: true }`, shared theme via `registerTheme`
  - Charts lazy-loaded with `React.lazy` + `Suspense` skeleton
- **Radix UI + Tailwind** for the component layer. Wrap each primitive once in our own component (e.g. `<FilterSelect>`, `<Tip>`); app code doesn't import Radix directly.
  - Popover + Checkbox (multi-select filters), Popover (date range), ToggleGroup (pass/fail/all), Tabs (chart vs table view), Tooltip (defect badges), Dialog (compare mode), AlertDialog (clear filters, optional), ScrollArea (only if it works with TanStack Virtual)
- **TanStack Virtual** for the large grid/list (5,000+ items).
- **Data**: Parquet files queried in the browser with **DuckDB-WASM** (Sift lists WebAssembly, Parquet, DuckDB). Seed scripts prepare everything ahead of time (thumbnails as small WebP).
- **Tests**: Vitest only, unit tests for pure functions (filters, URL helpers, chart option builders). No React Testing Library, no end-to-end tests.
- **Hosting**: Vercel.

## Non-functional targets

- First load < 2 s; filter updates < 100 ms on 5,000+ records; Lighthouse performance 90+
- Keyboard navigation, visible focus (move focus to heading on route change), WCAG AA contrast, chart data reachable as text
- Desktop browser only (laptop and larger screens); no phone layout or phone testing. Loading, empty and error states everywhere

## PX4 data pipeline (Sift mode)

```bash
git clone --recursive https://github.com/PX4/flight_review.git
cd flight_review/app
pip install -r requirements.txt        # or just: pip install requests
python download_logs.py --print --mav-type Quadrotor --error-labels Vibration
python download_logs.py -n 5 --mav-type Quadrotor --error-labels Vibration -d ../../logs/vibration
python download_logs.py -n 5 --mav-type Quadrotor --rating Good -d ../../logs/good

pip install pyulog
ulog_info <log>.ulg
ulog2csv <log>.ulg -o csv/ -m battery_status,vehicle_attitude,vehicle_local_position,sensor_combined,actuator_outputs
```

- Error labels available: Vibration, Sensor-error, Component-failure, Software, Human-error, External-conditions, Airframe-design, Other
- Keep the default download rate limit (~6 s between files)
- Confirm topic names with `ulog_info`; convert CSV → Parquet in the seed script; credit the source and check license terms in the README
- Starting set: ~3 vibration, ~2 sensor-error/component-failure, ~3 good flights

## Build order

Sift mode first (exercises the performance-heavy parts), then Instrumental mode (mostly a new dataset plus the image detail view). Within each, follow the phases in the plan doc: setup and data → thin slice of the demo story → charts drive filters → detail view → scale and performance → polish. Every phase ends deployed.

## README (for reviewers)

One-line pitch + live link, 20–30 s GIF of the demo story, the user and their problem, key design decisions, performance numbers, what's next, dataset credits.
