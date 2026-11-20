"use client"

import { ChevronDownIcon, GripIcon } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { InputGroupButton } from "@/components/ui/input-group"
import { GAME_MODELS, type GameModelId } from "@/lib/games/model-catalog"

export function ModelPicker({
  modelId,
  onModelChange,
}: {
  modelId: GameModelId
  onModelChange: (modelId: GameModelId) => void
}) {
  const selected = GAME_MODELS.find((model) => model.id === modelId)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <InputGroupButton>
            <GripIcon />
            {selected?.name ?? modelId}
            <ChevronDownIcon />
          </InputGroupButton>
        }
      />
      <DropdownMenuContent className="w-72">
        <DropdownMenuRadioGroup
          value={modelId}
          onValueChange={(value) => onModelChange(value as GameModelId)}
        >
          {GAME_MODELS.map((model) => (
            <DropdownMenuRadioItem
              key={model.id}
              value={model.id}
              className="py-1.5"
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">{model.name}</span>
                <span className="text-xs text-muted-foreground">
                  {model.tagline}
                </span>
              </div>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
