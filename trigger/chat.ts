import { chat, upsertIncomingMessage } from "@trigger.dev/sdk/ai"
import { stepCountIs, streamText } from "ai"
import { z } from "zod"

import { gameModelSettings } from "@/lib/games/agent"
import {
  loadGameMessages,
  saveGameMessages,
  saveGameTurn,
} from "@/lib/games/chat-store"
import { gameInstructions } from "@/lib/games/instructions"
import { DEFAULT_GAME_MODEL_ID, GAME_MODELS } from "@/lib/games/model-catalog"
import { describeError, elapsed, logger } from "@/lib/observability"
import { createGameTools } from "@/lib/games/tools"
import { createGameWorkspace } from "@/lib/workspace/local"

const gameClientDataSchema = z
  .object({
    modelId: z.enum(GAME_MODELS.map((model) => model.id)).optional(),
  })
  .optional()

const MAX_STEPS = 48

export const gameChat = chat.agent({
  id: "game-chat",
  clientDataSchema: gameClientDataSchema,
  hydrateMessages: async ({ chatId, trigger, incomingMessages }) => {
    const startedAt = performance.now()
    const stored = await loadGameMessages(chatId)

    const appended = upsertIncomingMessage(stored, {
      trigger,
      incomingMessages,
    })

    logger.info(logger.fmt`Chat turn starting for game ${chatId}`, {
      "game.id": chatId,
      "chat.stored_messages": stored.length,
      "chat.incoming_messages": incomingMessages.length,
      "chat.appended_incoming": appended,
      duration_ms: elapsed(startedAt),
    })

    return stored
  },
  onChatStart: async ({ chatId }) => {
    try {
      await createGameWorkspace(chatId)
    } catch (error) {
      logger.error(
        logger.fmt`Could not create the workspace for game ${chatId}`,
        { "game.id": chatId, ...describeError(error) }
      )

      throw error
    }
  },
  onTurnStart: async ({ chatId, uiMessages }) => {
    await saveGameMessages({ gameId: chatId, messages: uiMessages })
  },
  onTurnComplete: async ({
    chatId,
    uiMessages,
    chatAccessToken,
    lastEventId,
    clientData,
  }) => {
    const startedAt = performance.now()

    try {
      await saveGameTurn({
        gameId: chatId,
        messages: uiMessages,
        chatAccessToken,
        chatLastEventId: lastEventId,
      })
    } catch (error) {
      logger.error(
        logger.fmt`Could not persist the finished turn for game ${chatId}`,
        {
          "game.id": chatId,
          "chat.messages": uiMessages.length,
          "chat.has_cursor": lastEventId !== undefined,
          ...describeError(error),
        }
      )

      throw error
    }

    logger.info(logger.fmt`Chat turn complete for game ${chatId}`, {
      "game.id": chatId,
      "gen_ai.request.model": clientData?.modelId ?? DEFAULT_GAME_MODEL_ID,
      "chat.messages": uiMessages.length,
      "chat.has_cursor": lastEventId !== undefined,
      duration_ms: elapsed(startedAt),
    })
  },
  tools: ({ chatId }) => createGameTools(chatId),
  run: async ({ messages, tools, signal, clientData, chatId }) => {
    const modelId = clientData?.modelId ?? DEFAULT_GAME_MODEL_ID

    if (messages.at(-1)?.role === "assistant") {
      logger.warn(
        logger.fmt`Skipped a turn with nothing to answer for game ${chatId}`,
        {
          "game.id": chatId,
          "chat.messages": messages.length,
        }
      )

      return
    }

    return streamText({
      ...chat.toStreamTextOptions({ tools }),
      ...gameModelSettings(modelId),
      instructions: gameInstructions,
      messages,
      abortSignal: signal,
      stopWhen: stepCountIs(MAX_STEPS),
    })
  },
})
