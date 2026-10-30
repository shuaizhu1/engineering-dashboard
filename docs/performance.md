# Performance

Measured 2026-10-30 on a production build (`npm run build`) served with compression (`npx serve@14.2.6 dist -s`), Chrome headless, Lighthouse 13.5 desktop preset.

## First load

| | Before | After |
| --- | --- | --- |
| Lighthouse performance / accessibility / best practices | 99 / 100 / 100 | 100 / 100 / 100 |
| Dashboard data ready (`sift-data-ready` mark, devtools throttling) | 1,543 ms | 81 ms |
| Dashboard data ready (localhost, no throttling) | 1,265 ms | 113 ms |
| Main JS bundle (gzip) | 175 KB | 158 KB |

Before, the dashboard waited for DuckDB-WASM (a 34 MB WebAssembly module, about 8 MB gzipped) to download and compile before it could read the 16 KB of summary data. Lighthouse still scored 99 because its largest paint was the loading message.

Now the summary tables (`flights.parquet`, `events.parquet`) are read with [hyparquet](https://github.com/hyparam/hyparquet), a small pure-JS Parquet reader. DuckDB-WASM loads during idle time after the dashboard renders and handles the telemetry table (8 MB Parquet) on the flight page. A direct link to a flight page loads DuckDB on demand.

## Filter updates

| Scenario | Time | Budget |
| --- | --- | --- |
| Data work for one filter change: 10,000 flights, 50,000 events (`src/filters/performance.test.ts`, median of 7) | 12.9 ms | 100 ms |
| Full update in the browser, 5,017 flights (`?stress=5000`): click to next painted frame, including React render and both chart redraws | 38–52 ms | 100 ms |

`?stress=N` clones the real flights into N synthetic ones (deterministic, labeled in the UI) to exercise the dashboard at scale. The flight grid is virtualized with TanStack Virtual, so only the visible rows are in the DOM.
