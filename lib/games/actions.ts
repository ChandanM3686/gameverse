"use server"

import { google } from "@ai-sdk/google"
import { generateText } from "ai"
import { refresh } from "next/cache"
import { redirect } from "next/navigation"

import { deleteGameRow, insertGameRow, updateGameRow } from "@/lib/db/client"
import { authorizeGame } from "@/lib/games/authorize"
import { endGameChatSession } from "@/lib/games/chat-session"
import { generateMessageId } from "@/lib/games/messages"
import {
  DEFAULT_GAME_MODEL_ID,
  type GameModelId,
  isGameModelId,
} from "@/lib/games/model-catalog"
import { truncateTitle } from "@/lib/games/title"
import { describeError, elapsed, logger } from "@/lib/observability"

const TITLE_MODEL = "gemini-2.5-flash"

async function generateTitle(prompt: string) {
  const startedAt = performance.now()

  try {
    const { text } = await generateText({
      model: google(TITLE_MODEL),
      instructions:
        "You name games from the prompt that created them. Reply with a title " +
        "of at most four words in title case. No quotes, no punctuation at the " +
        "end, no explanation — the title only.",
      prompt,
      maxOutputTokens: 64,
      providerOptions: {
        google: { thinkingConfig: { thinkingBudget: 0 } },
      },
    })

    const title = text.trim().replace(/^["'“”]+|["'“”]+$/g, "")

    return title || truncateTitle(prompt)
  } catch (error) {
    logger.warn("Title generation failed, falling back to the prompt", {
      "gen_ai.request.model": TITLE_MODEL,
      ...describeError(error),
      duration_ms: elapsed(startedAt),
    })

    return truncateTitle(prompt)
  }
}

export async function createGame(prompt: string, modelId: GameModelId) {
  const startedAt = performance.now()
  const trimmedPrompt = typeof prompt === "string" ? prompt.trim() : ""

  if (!trimmedPrompt) {
    return
  }

  const model = isGameModelId(modelId) ? modelId : DEFAULT_GAME_MODEL_ID

  const game = await insertGameRow({
    title: truncateTitle(await generateTitle(trimmedPrompt)),
    messages: [
      {
        id: generateMessageId(),
        role: "user",
        parts: [{ type: "text", text: trimmedPrompt }],
      },
    ],
  })

  logger.info(logger.fmt`Created game ${game.id}`, {
    "game.id": game.id,
    "game.model": model,
    duration_ms: elapsed(startedAt),
  })

  refresh()

  redirect(
    model === DEFAULT_GAME_MODEL_ID
      ? `/games/${game.id}`
      : `/games/${game.id}?model=${model}`
  )
}

export async function renameGame(gameId: string, title: string) {
  const { game } = await authorizeGame(gameId, "renameGame")

  const trimmed = typeof title === "string" ? truncateTitle(title.trim()) : ""

  if (!trimmed || trimmed === game.title) {
    return
  }

  await updateGameRow(gameId, { title: trimmed })

  refresh()
}

export async function deleteGame(gameId: string, returnHome: boolean) {
  await authorizeGame(gameId, "deleteGame")

  await endGameChatSession(gameId)
  await deleteGameRow(gameId)

  logger.info(logger.fmt`Deleted game ${gameId}`, { "game.id": gameId })

  refresh()

  if (returnHome) {
    redirect("/")
  }
}
