import { google } from "@ai-sdk/google"
import type { LanguageModel } from "ai"

import type { GameModelId } from "./model-catalog"

export const gameModels = {
  "gemini-3.5-flash": google("gemini-3.5-flash"),
  "gemini-3.1-pro-preview": google("gemini-3.1-pro-preview"),
  "gemini-2.5-flash": google("gemini-2.5-flash"),
} satisfies Record<GameModelId, LanguageModel>
