# Line Inspector – Project Context

Portfolio project for a frontend job application at **Instrumental** (AI for electronics manufacturing): exploring PCB inspection results from an assembly line over time.

Split on 2026-10-30 from the shared "Engineering Data Explorer". The Sift project (PX4 flight telemetry) now lives in `~/Documents/sift-telemetry`; there is no mode switching. Display names and colors live in `src/config.ts`. `docs/performance.md` still has the Sift-era measurements until the performance phase is redone.

Full requirements and phased plan (Claude Docs): https://claude.ai/code/artifact/77023540-0de2-437c-ab54-f4e5cc36ee27

## Goal and demo story

A user should be able to, in about 60 seconds:
1. See first-pass yield over time and spot a dip.
2. Brush or click the chart to filter to that window.
3. See which defect type spiked in a breakdown (Pareto) chart and click it to filter.
4. Open a board and inspect the detail (board image with defect boxes).

## Data

Real PCB images and defect boxes from DeepPCB, wrapped in synthetic production context: one row per inspected board (serial, line L1–L3, station AOI-1/AOI-2, timestamp, pass/fail, defects) with a planted defect spike (shorts on L2 / AOI-2, Oct 14–15). Failed boards show a DeepPCB tested image with its annotated defects; passed boards show the defect-free template. Detail view = board image with SVG defect boxes, zoom and pan, station history.

## Tech decisions (already made)

- **Vite + React + TypeScript (strict)**. No Next.js.
- **React Router** data router (`createBrowserRouter`):
  - `/` dashboard; all filters in the query string via `useSearchParams` + a typed parse/serialize helper
  - `/units/:serial` lazy-loaded with the route `lazy` option; preserve the query string for "back to results"
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
- **Data**: Parquet files in the browser, read with **hyparquet** (pure JS). The seed script prepares everything ahead of time (board images as lossless WebP, thumbnails as small lossy WebP). See `docs/performance.md`.
- **Tests**: Vitest only, unit tests for pure functions (filters, URL helpers, chart option builders). No React Testing Library, no end-to-end tests.
- **Hosting**: Vercel.

## Non-functional targets

- First load < 2 s; filter updates < 100 ms on 5,000+ records; Lighthouse performance 90+
- Keyboard navigation, visible focus (move focus to heading on route change), WCAG AA contrast, chart data reachable as text
- Desktop browser only (laptop and larger screens); no phone layout or phone testing. Loading, empty and error states everywhere

## DeepPCB data pipeline

```bash
# Sparse clone: only the groups you need (full repo is ~88 MB; two groups give 235 image pairs)
git clone --depth 1 --filter=blob:none --sparse https://github.com/tangsanli5201/DeepPCB.git data/raw/deeppcb
git -C data/raw/deeppcb sparse-checkout set PCBData/group00041 PCBData/group12000

.venv/bin/pip install pandas pyarrow pillow
.venv/bin/python scripts/seed_instrumental.py                          # sample: 1,500 boards, 40 image pairs
.venv/bin/python scripts/seed_instrumental.py --units 5000 --images 0  # scale test
```

- DeepPCB: 640×640 binarized image pairs (tested + template), defects annotated as `x1 y1 x2 y2 type` (space-separated, despite the README saying commas); types 1 open, 2 short, 3 mousebite, 4 spur, 5 copper, 6 pin-hole. Defects were augmented by hand, 3–12 per image, and types are balanced within each image.
- MIT license; credit it in the README and say plainly that the line/station/time context is synthetic.

## Build order

Follow the phases in the plan doc: setup and data → thin slice of the demo story → charts drive filters → detail view → scale and performance → polish. Every phase ends deployed.

## README (for reviewers)

One-line pitch + live link, 20–30 s GIF of the demo story, the user and their problem, key design decisions, performance numbers, what's next, dataset credits.
