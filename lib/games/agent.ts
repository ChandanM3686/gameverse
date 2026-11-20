import type { GameModelId } from "./model-catalog"
import { gameModels } from "./models"

export function gameModelSettings(modelId: GameModelId) {
  return { model: gameModels[modelId] }
}
