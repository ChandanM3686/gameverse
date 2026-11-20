"use server"

import { auth as triggerAuth } from "@trigger.dev/sdk"
import { chat, type ChatStartSessionParams } from "@trigger.dev/sdk/ai"

import { authorizeGame } from "@/lib/games/authorize"
import { describeError, elapsed, logger } from "@/lib/observability"
import type { gameChat } from "@/trigger/chat"

const startSession = chat.createStartSessionAction<typeof gameChat>("game-chat")

export async function startGameChatSession(
  params: ChatStartSessionParams<typeof gameChat>
) {
  const startedAt = performance.now()

  await authorizeGame(params.chatId, "startGameChatSession")

  try {
    const session = await startSession(params)

    logger.info(logger.fmt`Started chat session for game ${params.chatId}`, {
      "game.id": params.chatId,
      duration_ms: elapsed(startedAt),
    })

    return session
  } catch (error) {
    logger.error(
      logger.fmt`Could not start chat session for game ${params.chatId}`,
      { "game.id": params.chatId, ...describeError(error) }
    )

    throw error
  }
}

export async function mintGameChatAccessToken(chatId: string) {
  await authorizeGame(chatId, "mintGameChatAccessToken")

  return triggerAuth.createPublicToken({
    scopes: {
      read: { sessions: chatId },
      write: { sessions: chatId },
    },
    expirationTime: "1h",
  })
}
