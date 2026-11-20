import { notFound } from "next/navigation"

import { GameChat } from "@/components/game-chat"
import { GameMenu } from "@/components/game-menu"
import { DEFAULT_GAME_MODEL_ID, isGameModelId } from "@/lib/games/model-catalog"
import { getGame } from "@/lib/games/queries"

export default async function GamePage({
  params,
  searchParams,
}: PageProps<"/games/[id]">) {
  const { id } = await params
  const game = await getGame(id)

  if (!game) {
    notFound()
  }

  const { model } = await searchParams

  return (
    <div className="flex h-svh flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b px-4">
        <span className="truncate font-heading text-sm font-medium">
          {game.title}
        </span>
        <GameMenu gameId={game.id} title={game.title} />
      </header>
      <GameChat
        gameId={game.id}
        initialMessages={game.messages}
        initialModelId={isGameModelId(model) ? model : DEFAULT_GAME_MODEL_ID}
        sandboxId={game.sandboxId}
        initialSession={
          game.chatAccessToken
            ? {
                publicAccessToken: game.chatAccessToken,
                lastEventId: game.chatLastEventId ?? undefined,
              }
            : undefined
        }
      />
    </div>
  )
}
