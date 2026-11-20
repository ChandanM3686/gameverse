import "server-only"

import type { Game } from "@/lib/db/client"
import { getGame } from "@/lib/games/queries"
import { logger } from "@/lib/observability"

export async function authorizeGame(
  gameId: string,
  action: string
): Promise<{ game: Game }> {
  const game = await getGame(gameId)

  if (!game) {
    logger.warn(logger.fmt`Rejected ${action} for unknown game ${gameId}`)
    throw new Error("Not Found")
  }

  return { game }
}
