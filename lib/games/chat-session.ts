import "server-only"

import { runs, sessions } from "@trigger.dev/sdk"

import { describeError, logger } from "@/lib/observability"

export async function endGameChatSession(gameId: string): Promise<void> {
  let currentRunId: string | null | undefined

  try {
    ;({ currentRunId } = await sessions.retrieve(gameId))
  } catch {
    return
  }

  if (currentRunId) {
    try {
      await runs.cancel(currentRunId)
    } catch (error) {
      logger.warn(logger.fmt`Could not cancel run ${currentRunId}`, {
        "game.id": gameId,
        ...describeError(error),
      })
    }
  }

  try {
    await sessions.close(gameId, { reason: "game deleted" })
  } catch (error) {
    logger.warn(logger.fmt`Could not close chat session of game ${gameId}`, {
      "game.id": gameId,
      ...describeError(error),
    })
  }
}
