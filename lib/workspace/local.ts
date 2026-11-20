import { readdir, readFile } from "node:fs/promises"
import path from "node:path"

import {
  getGameRow,
  listFileRows,
  putFileRow,
  updateGameRow,
} from "@/lib/db/client"
import { elapsed, logger } from "@/lib/observability"

export const GAME_DIR = "/game"

const RUNTIME_DIR = path.join(process.cwd(), "lib", "games", "runtime")

export function previewUrl(gameId: string): string {
  return `/play/${gameId}/index.html`
}

export async function createGameWorkspace(gameId: string): Promise<void> {
  const startedAt = performance.now()
  const entries = await readdir(RUNTIME_DIR, {
    recursive: true,
    withFileTypes: true,
  })

  let count = 0

  for (const entry of entries) {
    if (!entry.isFile()) continue
    const source = path.join(entry.parentPath, entry.name)
    const relative = path
      .relative(RUNTIME_DIR, source)
      .split(path.sep)
      .join("/")
    await putFileRow(gameId, relative, await readFile(source, "utf8"))
    count += 1
  }

  await updateGameRow(gameId, { sandboxId: gameId })

  logger.info(logger.fmt`Created workspace for game ${gameId}`, {
    "game.id": gameId,
    "workspace.seed_files": count,
    duration_ms: elapsed(startedAt),
  })
}

export async function ensureGameWorkspace(gameId: string): Promise<void> {
  const game = await getGameRow(gameId)

  if (!game) {
    throw new Error(`No game ${gameId} to get a workspace for`)
  }

  if (game.sandboxId && (await listFileRows(gameId)).length > 0) {
    return
  }

  await createGameWorkspace(gameId)
}
