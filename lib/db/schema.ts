import type { UIMessage } from "ai"

export type Game = {
  id: string
  title: string
  messages: UIMessage[]
  chatAccessToken: string | null
  chatLastEventId: string | null
  sandboxId: string | null
  createdAt: Date
  updatedAt: Date
}

export type GameFile = {
  path: string
  content: string
  size: number
}
