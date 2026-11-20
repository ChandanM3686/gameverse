import path from "node:path"

import { getFileRow } from "@/lib/db/client"
import { getGame } from "@/lib/games/queries"

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
}

export async function GET(
  _request: Request,
  ctx: RouteContext<"/play/[id]/[...path]">
) {
  const { id, path: segments } = await ctx.params
  const game = await getGame(id)

  if (!game) {
    return new Response("Game not found", { status: 404 })
  }

  const filePath = path.posix.normalize(segments.join("/"))

  if (filePath.startsWith("..") || path.posix.isAbsolute(filePath)) {
    return new Response("Forbidden", { status: 403 })
  }

  const file = await getFileRow(id, filePath)

  if (!file) {
    return new Response("Not found", { status: 404 })
  }

  const type =
    CONTENT_TYPES[path.posix.extname(filePath).toLowerCase()] ??
    "text/plain; charset=utf-8"

  return new Response(file.content, {
    headers: { "Content-Type": type, "Cache-Control": "no-store" },
  })
}
