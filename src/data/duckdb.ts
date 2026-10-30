import * as duckdb from '@duckdb/duckdb-wasm'
import ehWasm from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url'
import mvpWasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url'
import ehWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url'
import mvpWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url'

const bundles: duckdb.DuckDBBundles = {
  mvp: { mainModule: mvpWasm, mainWorker: mvpWorker },
  eh: { mainModule: ehWasm, mainWorker: ehWorker },
}

let dbPromise: Promise<duckdb.AsyncDuckDB> | undefined

/** One DuckDB instance per page, created on first use. */
export function getDb(): Promise<duckdb.AsyncDuckDB> {
  dbPromise ??= createDb().catch((error: unknown) => {
    dbPromise = undefined
    throw error
  })
  return dbPromise
}

async function createDb(): Promise<duckdb.AsyncDuckDB> {
  const bundle = await duckdb.selectBundle(bundles)
  const worker = new Worker(bundle.mainWorker!)
  const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker)
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker)
  return db
}

/** Expose Parquet files served from `public/` as views, e.g. `{ flights: '/data/sift/flights.parquet' }`. */
export async function registerParquetViews(views: Record<string, string>): Promise<void> {
  const db = await getDb()
  const conn = await db.connect()
  try {
    for (const [name, path] of Object.entries(views)) {
      const fileName = `${name}.parquet`
      const url = new URL(path, window.location.origin).href
      await db.registerFileURL(fileName, url, duckdb.DuckDBDataProtocol.HTTP, false)
      await conn.query(`CREATE OR REPLACE VIEW ${name} AS SELECT * FROM '${fileName}'`)
    }
  } finally {
    await conn.close()
  }
}

/** Run a query and return plain row objects. Cast BIGINT columns in SQL; they arrive as bigint otherwise. */
export async function query<T>(sql: string): Promise<T[]> {
  const db = await getDb()
  const conn = await db.connect()
  try {
    const table = await conn.query(sql)
    return table.toArray().map((row) => row.toJSON() as T)
  } finally {
    await conn.close()
  }
}

/** Run a parameterized query and return each column as a typed array (for numeric columns). */
export async function queryColumns(sql: string, ...params: unknown[]): Promise<Record<string, ArrayLike<unknown>>> {
  const db = await getDb()
  const conn = await db.connect()
  try {
    const statement = await conn.prepare(sql)
    try {
      const table = await statement.query(...params)
      const columns: Record<string, ArrayLike<unknown>> = {}
      for (const field of table.schema.fields) {
        columns[field.name] = table.getChild(field.name)!.toArray()
      }
      return columns
    } finally {
      await statement.close()
    }
  } finally {
    await conn.close()
  }
}
