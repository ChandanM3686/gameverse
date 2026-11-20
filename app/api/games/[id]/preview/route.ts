import { getGame } from "@/lib/games/queries"
import { previewUrl } from "@/lib/workspace/local"

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/games/[id]/preview">
) {
  const { id } = await ctx.params
  const game = await getGame(id)

  if (!game) {
    return Response.json({ error: "Game not found" }, { status: 404 })
  }

  if (!game.sandboxId) {
    return Response.json({ error: "Game has no files yet" }, { status: 409 })
  }

  return Response.json({ url: previewUrl(id) })
}
