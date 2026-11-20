"use client"

import { useEffect, useRef, useState } from "react"

import { Spinner } from "@/components/ui/spinner"
import { logger } from "@/lib/observability"

type Preview =
  | { status: "loading" }
  | { status: "ready"; url: string; revision: number }
  | { status: "error"; message: string }

export type GameError = {
  message: string
  source: string
  line: number | null
  column: number | null
  stack: string
}

const HEALTH_POLL_MS = 1000

const text = (value: unknown) => (typeof value === "string" ? value : "")
const count = (value: unknown) => (typeof value === "number" ? value : null)

function readError(data: unknown): GameError | null {
  if (typeof data !== "object" || data === null) return null

  const status = data as { type?: unknown; error?: unknown }
  if (status.type !== "game-status") return null
  if (typeof status.error !== "object" || status.error === null) return null

  const error = status.error as Record<string, unknown>

  return {
    message: text(error.message) || "Unknown error",
    source: text(error.source),
    line: count(error.line),
    column: count(error.column),
    stack: text(error.stack),
  }
}

function withoutQuery(value: string) {
  return value.replace(/[?#][^\s)'"]*/g, "")
}

function gameRelative(value: string, gameId: string) {
  const marker = new RegExp(`\\S*?/play/${gameId}/`, "g")
  return withoutQuery(value).replace(marker, "")
}

export function ChatPreview({
  gameId,
  revision,
  onGameError,
}: {
  gameId: string
  revision: number
  onGameError?: (error: GameError) => void
}) {
  const [preview, setPreview] = useState<Preview>({ status: "loading" })
  const frameRef = useRef<HTMLIFrameElement>(null)
  const onGameErrorRef = useRef(onGameError)

  useEffect(() => {
    onGameErrorRef.current = onGameError
  }, [onGameError])

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      try {
        const response = await fetch(`/api/games/${gameId}/preview`, {
          signal: controller.signal,
        })
        const body = await response.json()

        if (!response.ok) {
          throw new Error(body.error ?? "Preview is unavailable")
        }

        setPreview({ status: "ready", url: body.url, revision })
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        const message =
          error instanceof Error ? error.message : "Preview is unavailable"

        logger.warn(
          logger.fmt`Preview unavailable for game ${gameId}: ${message}`,
          {
            "game.id": gameId,
            "game.revision": revision,
            "exception.message": message,
            "preview.first_load": revision === 0,
          }
        )

        setPreview((current) =>
          current.status === "ready" ? current : { status: "error", message }
        )
      }
    }

    void load()

    return () => controller.abort()
  }, [gameId, revision])

  const ready = preview.status === "ready" ? preview : null

  useEffect(() => {
    const frame = frameRef.current
    if (!ready || !frame) return

    let reported = false

    const ping = () => {
      frame.contentWindow?.postMessage({ type: "game-ping" }, "*")
    }

    const onMessage = (event: MessageEvent) => {
      if (reported || !ready || event.source !== frame.contentWindow) return

      const error = readError(event.data)
      if (!error) return

      reported = true
      clearInterval(timer)

      const attributes: Record<string, string | number | boolean> = {
        "game.id": gameId,
        "game.revision": ready.revision,
        "exception.message": error.message,
      }

      if (error.stack) {
        attributes["exception.stacktrace"] = withoutQuery(error.stack)
      }
      if (error.source) {
        attributes["code.file.path"] = withoutQuery(error.source)
      }
      if (error.line !== null) attributes["code.line.number"] = error.line
      if (error.column !== null) attributes["code.column.number"] = error.column

      logger.warn(
        logger.fmt`Game preview crashed: ${error.message}`,
        attributes
      )

      onGameErrorRef.current?.({
        ...error,
        source: error.source ? gameRelative(error.source, gameId) : "",
        stack: error.stack ? gameRelative(error.stack, gameId) : "",
      })
    }

    window.addEventListener("message", onMessage)
    const timer = setInterval(ping, HEALTH_POLL_MS)
    ping()

    return () => {
      window.removeEventListener("message", onMessage)
      clearInterval(timer)
    }
  }, [ready, gameId])

  if (preview.status === "loading") {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner />
        Starting preview…
      </div>
    )
  }

  if (preview.status === "error") {
    return (
      <p className="flex h-full items-center justify-center p-4 text-center text-sm text-muted-foreground">
        {preview.message}
      </p>
    )
  }

  return (
    <iframe
      ref={frameRef}
      key={preview.revision}
      src={preview.url}
      title="Game preview"
      className="h-full w-full border-0 bg-white"
    />
  )
}
