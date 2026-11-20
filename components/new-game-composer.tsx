"use client"

import { useState, useTransition } from "react"

import { ChatComposer } from "@/components/chat-composer"
import { createGame } from "@/lib/games/actions"
import {
  DEFAULT_GAME_MODEL_ID,
  type GameModelId,
} from "@/lib/games/model-catalog"
import { suggestions } from "@/lib/games/suggestions"

export function NewGameComposer() {
  const [prompt, setPrompt] = useState("")
  const [modelId, setModelId] = useState<GameModelId>(DEFAULT_GAME_MODEL_ID)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(value: string) {
    startTransition(async () => {
      await createGame(value, modelId)
    })
  }

  function handleSuggestion(suggestionPrompt: string) {
    setPrompt(suggestionPrompt)
    handleSubmit(suggestionPrompt)
  }

  return (
    <>
      <div className="rounded-2xl bg-card/70 p-1.5 text-left neon-ring backdrop-blur">
        <ChatComposer
          value={prompt}
          onValueChange={setPrompt}
          onSubmit={handleSubmit}
          modelId={modelId}
          onModelChange={setModelId}
          disabled={isPending}
          placeholder="A neon hover-bike race through a rainy cyberpunk city…"
        />
      </div>
      <div className="flex flex-col gap-3">
        <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
          Or start from a template
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.label}
              type="button"
              disabled={isPending}
              onClick={() => handleSuggestion(suggestion.prompt)}
              className="group flex items-center gap-2 rounded-xl border bg-card/50 px-3 py-2.5 text-left text-sm text-muted-foreground backdrop-blur transition hover:-translate-y-0.5 hover:border-primary/60 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                <suggestion.icon className="size-4" />
              </span>
              <span className="truncate">{suggestion.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
