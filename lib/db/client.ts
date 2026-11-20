import { randomUUID } from "node:crypto"

import type { UIMessage } from "ai"

import type { Game, GameFile } from "./schema"

export * from "./schema"

type Param = string | number | null

type Driver = {
  all: <T>(sql: string, params?: Param[]) => Promise<T[]>
  run: (sql: string, params?: Param[]) => Promise<void>
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    messages TEXT NOT NULL DEFAULT '[]',
    chat_access_token TEXT,
    chat_last_event_id TEXT,
    sandbox_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS games_created_at_idx ON games (created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS game_files (
    game_id TEXT NOT NULL,
    path TEXT NOT NULL,
    content TEXT NOT NULL,
    size INTEGER NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (game_id, path)
  )`,
]

async function createPostgres(url: string): Promise<Driver> {
  const { Pool } = await import("pg")
  const pool = new Pool({ connectionString: url, max: 5 })
  const toPg = (sql: string) => {
    let index = 0
    return sql.replace(/\?/g, () => `$${++index}`)
  }

  return {
    all: async <T>(sql: string, params: Param[] = []) =>
      (await pool.query(toPg(sql), params)).rows as T[],
    run: async (sql, params = []) => {
      await pool.query(toPg(sql), params)
    },
  }
}

async function createSqlite(): Promise<Driver> {
  const { DatabaseSync } = await import("node:sqlite")
  const { mkdirSync } = await import("node:fs")
  const path = await import("node:path")

  const dir = path.join(process.cwd(), ".data")
  mkdirSync(dir, { recursive: true })

  const db = new DatabaseSync(path.join(dir, "gameverse.db"))
  db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;")

  return {
    all: async <T>(sql: string, params: Param[] = []) =>
      db.prepare(sql).all(...params) as T[],
    run: async (sql, params = []) => {
      db.prepare(sql).run(...params)
    },
  }
}

async function connect(): Promise<Driver> {
  const url = process.env.DATABASE_URL
  const driver = url ? await createPostgres(url) : await createSqlite()

  for (const statement of SCHEMA) {
    await driver.run(statement)
  }

  return driver
}

const globalForDb = globalThis as unknown as { gameverseDb?: Promise<Driver> }

function db(): Promise<Driver> {
  globalForDb.gameverseDb ??= connect().catch((error) => {
    globalForDb.gameverseDb = undefined
    throw error
  })
  return globalForDb.gameverseDb
}

type GameRow = {
  id: string
  title: string
  messages: string
  chat_access_token: string | null
  chat_last_event_id: string | null
  sandbox_id: string | null
  created_at: string
  updated_at: string
}

function toGame(row: GameRow): Game {
  return {
    id: row.id,
    title: row.title,
    messages: JSON.parse(row.messages) as UIMessage[],
    chatAccessToken: row.chat_access_token,
    chatLastEventId: row.chat_last_event_id,
    sandboxId: row.sandbox_id,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

export async function listGameRows(): Promise<Game[]> {
  const rows = await (
    await db()
  ).all<GameRow>("SELECT * FROM games ORDER BY created_at DESC")
  return rows.map(toGame)
}

export async function getGameRow(id: string): Promise<Game | undefined> {
  const [row] = await (
    await db()
  ).all<GameRow>("SELECT * FROM games WHERE id = ?", [id])
  return row ? toGame(row) : undefined
}

export async function insertGameRow(input: {
  title: string
  messages: UIMessage[]
}): Promise<{ id: string }> {
  const id = randomUUID()
  const now = new Date().toISOString()
  await (
    await db()
  ).run(
    "INSERT INTO games (id, title, messages, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    [id, input.title, JSON.stringify(input.messages), now, now]
  )
  return { id }
}

const columns = {
  title: "title",
  messages: "messages",
  chatAccessToken: "chat_access_token",
  chatLastEventId: "chat_last_event_id",
  sandboxId: "sandbox_id",
} as const

type Patch = Partial<Pick<Game, keyof typeof columns>>

export async function updateGameRow(id: string, patch: Patch): Promise<void> {
  const sets: string[] = []
  const values: Param[] = []

  for (const [key, column] of Object.entries(columns)) {
    if (!(key in patch)) continue
    const value = patch[key as keyof Patch]
    sets.push(`${column} = ?`)
    values.push(
      key === "messages" ? JSON.stringify(value) : ((value as string) ?? null)
    )
  }

  if (sets.length === 0) return

  sets.push("updated_at = ?")
  values.push(new Date().toISOString(), id)

  await (
    await db()
  ).run(`UPDATE games SET ${sets.join(", ")} WHERE id = ?`, values)
}

export async function deleteGameRow(id: string): Promise<void> {
  const driver = await db()
  await driver.run("DELETE FROM game_files WHERE game_id = ?", [id])
  await driver.run("DELETE FROM games WHERE id = ?", [id])
}

export async function listFileRows(
  gameId: string,
  prefix = ""
): Promise<Omit<GameFile, "content">[]> {
  const rows = await (
    await db()
  ).all<{ path: string; size: number | string }>(
    "SELECT path, size FROM game_files WHERE game_id = ? AND substr(path, 1, length(?)) = ? ORDER BY path",
    [gameId, prefix, prefix]
  )
  return rows.map((row) => ({ path: row.path, size: Number(row.size) }))
}

export async function getFileRow(
  gameId: string,
  filePath: string
): Promise<GameFile | undefined> {
  const [row] = await (
    await db()
  ).all<{ path: string; content: string; size: number | string }>(
    "SELECT path, content, size FROM game_files WHERE game_id = ? AND path = ?",
    [gameId, filePath]
  )
  return row ? { ...row, size: Number(row.size) } : undefined
}

export async function putFileRow(
  gameId: string,
  filePath: string,
  content: string
): Promise<void> {
  await (
    await db()
  ).run(
    `INSERT INTO game_files (game_id, path, content, size, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (game_id, path) DO UPDATE SET
       content = excluded.content,
       size = excluded.size,
       updated_at = excluded.updated_at`,
    [
      gameId,
      filePath,
      content,
      Buffer.byteLength(content, "utf8"),
      new Date().toISOString(),
    ]
  )
}

export async function deleteFileRows(
  gameId: string,
  filePath: string
): Promise<void> {
  const folder = `${filePath}/`
  await (
    await db()
  ).run(
    "DELETE FROM game_files WHERE game_id = ? AND (path = ? OR substr(path, 1, length(?)) = ?)",
    [gameId, filePath, folder, folder]
  )
}
