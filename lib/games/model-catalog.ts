export const GAME_MODELS = [
  {
    id: "gemini-3.5-flash",
    name: "Gemini 3.5 Flash",
    tagline: "Fast and capable — the default for building and iterating.",
  },
  {
    id: "gemini-3.1-pro-preview",
    name: "Gemini 3.1 Pro",
    tagline: "The strongest reasoning — best for a big game from scratch.",
  },
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    tagline: "Quick and cheap — best for small, specific tweaks.",
  },
] as const

export type GameModelId = (typeof GAME_MODELS)[number]["id"]

export const DEFAULT_GAME_MODEL_ID: GameModelId = "gemini-3.5-flash"

export function isGameModelId(value: unknown): value is GameModelId {
  return GAME_MODELS.some((model) => model.id === value)
}
