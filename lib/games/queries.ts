import "server-only"

import { getGameRow, listGameRows, type Game } from "@/lib/db/client"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function listGames(): Promise<Game[]> {
  return listGameRows()
}

export async function getGame(id: string): Promise<Game | undefined> {
  return UUID_RE.test(id) ? await getGameRow(id) : undefined
}
