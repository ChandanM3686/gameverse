import type { UIMessage } from "ai"

import { getGameRow, updateGameRow } from "@/lib/db/client"

export async function loadGameMessages(gameId: string): Promise<UIMessage[]> {
  return (await getGameRow(gameId))?.messages ?? []
}

export async function saveGameMessages({
  gameId,
  messages,
}: {
  gameId: string
  messages: UIMessage[]
}): Promise<void> {
  await updateGameRow(gameId, { messages })
}

export async function saveGameTurn({
  gameId,
  messages,
  chatAccessToken,
  chatLastEventId,
}: {
  gameId: string
  messages: UIMessage[]
  chatAccessToken: string
  chatLastEventId: string | undefined
}): Promise<void> {
  await updateGameRow(gameId, {
    messages,
    chatAccessToken,
    chatLastEventId: chatLastEventId ?? null,
  })
}
