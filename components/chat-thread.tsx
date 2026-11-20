"use client"

import { useChat } from "@ai-sdk/react"
import type { ChatSessionPersistedState } from "@trigger.dev/sdk/chat"
import { useTriggerChatTransport } from "@trigger.dev/sdk/chat/react"
import {
  getToolName,
  isToolUIPart,
  lastAssistantMessageIsCompleteWithToolCalls,
} from "ai"
import type {
  DynamicToolUIPart,
  ToolUIPart,
  UIMessage,
  UIMessageChunk,
} from "ai"
import {
  BugIcon,
  CheckIcon,
  CircleAlertIcon,
  CircleQuestionMarkIcon,
  WrenchIcon,
} from "lucide-react"
import Image from "next/image"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { ChatComposer } from "@/components/chat-composer"
import type { GameError } from "@/components/chat-preview"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker"
import { Message, MessageAvatar, MessageContent } from "@/components/ui/message"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import {
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireChoice,
  QuestionnaireChoiceDescription,
  QuestionnaireChoices,
  QuestionnaireError,
  QuestionnaireItem,
  QuestionnaireSubmit,
  QuestionnaireTitle,
} from "@/components/ui/questionnaire"
import { Spinner } from "@/components/ui/spinner"
import {
  mintGameChatAccessToken,
  startGameChatSession,
} from "@/lib/games/chat-actions"
import type { GameModelId } from "@/lib/games/model-catalog"
import { describeError, logger } from "@/lib/observability"
import { cn } from "@/lib/utils"
import type { gameChat } from "@/trigger/chat"

const ASK_PLAYER = "ask_player"

export function ChatThread({
  gameId,
  initialMessages,
  initialModelId,
  initialSession,
  onTurnComplete,
  gameError,
  onGameErrorHandled,
}: {
  gameId: string
  initialMessages: UIMessage[]
  initialModelId: GameModelId
  initialSession?: ChatSessionPersistedState
  onTurnComplete: () => void
  gameError?: GameError | null
  onGameErrorHandled?: () => void
}) {
  const [prompt, setPrompt] = useState("")
  const [modelId, setModelId] = useState<GameModelId>(initialModelId)

  const clientData = useMemo(() => ({ modelId }), [modelId])

  const transport = useTriggerChatTransport<typeof gameChat>({
    task: "game-chat",
    accessToken: ({ chatId }) => mintGameChatAccessToken(chatId),
    startSession: ({ chatId, clientData }) =>
      startGameChatSession({ chatId, clientData }),
    clientData,
    sessions: initialSession ? { [gameId]: initialSession } : undefined,
  })

  const [resumedHeadId] = useState(() => {
    const last = initialMessages.at(-1)

    return last?.role === "assistant" ? last.id : undefined
  })

  const chatTransport = useMemo(
    () => ({
      sendMessages: transport.sendMessages,
      reconnectToStream: async (
        options: Parameters<typeof transport.reconnectToStream>[0]
      ) => {
        const stream = await transport.reconnectToStream(options)

        return stream && resumedHeadId
          ? stream.pipeThrough(withoutContinuationOf(resumedHeadId))
          : stream
      },
    }),
    [transport, resumedHeadId]
  )

  const messageCount = useRef(0)

  const {
    messages,
    sendMessage,
    addToolOutput,
    stop: stopStream,
    status,
    error,
  } = useChat({
    id: gameId,
    messages: initialMessages,
    transport: chatTransport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    resume: Boolean(initialSession),
    onFinish: onTurnComplete,
    onError: (error) => {
      logger.error(logger.fmt`Chat turn failed for game ${gameId}`, {
        "game.id": gameId,
        "chat.messages": messageCount.current,
        "chat.resumed": Boolean(initialSession),
        ...describeError(error),
      })
    },
  })

  useEffect(() => {
    messageCount.current = messages.length
  }, [messages])

  const submittedGameId = useRef<string | null>(null)

  useEffect(() => {
    if (submittedGameId.current === gameId) {
      return
    }

    submittedGameId.current = gameId

    if (initialMessages.at(-1)?.role === "user") {
      sendMessage()
    }
  }, [gameId, initialMessages, sendMessage])

  function handleFixGameError() {
    if (!gameError) return

    const location = gameError.source
      ? `\nLocation: ${gameError.source}${gameError.line !== null ? `:${gameError.line}` : ""}${gameError.column !== null ? `:${gameError.column}` : ""}`
      : ""
    const stack = gameError.stack ? `\nStack:\n${gameError.stack}` : ""

    sendMessage({
      text: `The game crashed in the preview, so nothing renders.\nError: ${gameError.message}${location}${stack}\n\nRead the file, find the root cause and fix it without changing how the game plays.`,
    })
    onGameErrorHandled?.()
  }

  function handleSubmit(value: string) {
    sendMessage({ text: value })
    setPrompt("")
  }

  const handleStop = useCallback(() => {
    void transport.stopGeneration(gameId)
    stopStream()
  }, [transport, gameId, stopStream])

  const lastMessage = messages.at(-1)
  const pendingQuestion = Boolean(
    lastMessage?.parts.some(
      (part) =>
        isToolUIPart(part) &&
        getToolName(part) === ASK_PLAYER &&
        part.state === "input-available"
    )
  )

  return (
    <div className="flex h-full flex-col">
      <MessageScrollerProvider>
        <MessageScroller className="flex-1">
          <MessageScrollerViewport>
            <MessageScrollerContent className="mx-auto w-full max-w-3xl px-4 py-8">
              {messages.map((message) => (
                <MessageScrollerItem key={message.id} messageId={message.id}>
                  <Message align={message.role === "user" ? "end" : "start"}>
                    {message.role === "assistant" && (
                      <MessageAvatar className="size-8 self-start rounded-lg bg-transparent">
                        <Image
                          src="/logo.svg"
                          alt="GameVerse"
                          width={32}
                          height={32}
                          className="size-8"
                        />
                      </MessageAvatar>
                    )}
                    <MessageContent>
                      <Bubble
                        variant={
                          message.role === "user" ? "secondary" : "ghost"
                        }
                        align={message.role === "user" ? "end" : "start"}
                      >
                        <BubbleContent className="flex flex-col items-start gap-2">
                          {message.parts.map((part, index) => {
                            if (part.type === "text") {
                              return <span key={index}>{part.text}</span>
                            }

                            if (
                              isToolUIPart(part) &&
                              getToolName(part) === ASK_PLAYER
                            ) {
                              return (
                                <AskPlayerCard
                                  key={part.toolCallId}
                                  part={part}
                                  onAnswer={
                                    message.id === lastMessage?.id
                                      ? (option) =>
                                          void addToolOutput({
                                            tool: ASK_PLAYER,
                                            toolCallId: part.toolCallId,
                                            output: {
                                              optionId: option.id,
                                              label: option.label,
                                            },
                                          })
                                      : undefined
                                  }
                                />
                              )
                            }

                            if (isToolUIPart(part)) {
                              return (
                                <ToolCallMarker
                                  key={part.toolCallId}
                                  part={part}
                                />
                              )
                            }

                            return null
                          })}
                        </BubbleContent>
                      </Bubble>
                    </MessageContent>
                  </Message>
                </MessageScrollerItem>
              ))}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>
      <div className="mx-auto flex w-full max-w-3xl shrink-0 flex-col gap-3 px-4 pb-4">
        {error ? (
          <Alert>
            <CircleAlertIcon />
            <AlertTitle>That turn didn&apos;t finish</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        ) : gameError && status === "ready" && !pendingQuestion ? (
          <Alert className="border-destructive/50">
            <BugIcon />
            <AlertTitle>The game crashed in the preview</AlertTitle>
            <AlertDescription>
              <p className="font-mono text-xs break-all">
                {gameError.message}
                {gameError.source
                  ? ` (${gameError.source}${gameError.line !== null ? `:${gameError.line}` : ""})`
                  : ""}
              </p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={handleFixGameError}>
                  <WrenchIcon />
                  Fix with AI
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onGameErrorHandled?.()}
                >
                  Dismiss
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        ) : null}
        <ChatComposer
          value={prompt}
          onValueChange={setPrompt}
          onSubmit={handleSubmit}
          onStop={handleStop}
          modelId={modelId}
          onModelChange={setModelId}
          streaming={status === "submitted" || status === "streaming"}
          disabled={status !== "ready" || pendingQuestion}
          placeholder={
            pendingQuestion ? "Pick an answer above…" : "Ask for a change…"
          }
        />
      </div>
    </div>
  )
}

function withoutContinuationOf(messageId: string) {
  return new TransformStream<UIMessageChunk, UIMessageChunk>({
    transform(chunk, controller) {
      if (chunk.type === "start" && chunk.messageId === messageId) {
        return
      }

      controller.enqueue(chunk)
    },
  })
}

function ToolCallMarker({ part }: { part: ToolUIPart | DynamicToolUIPart }) {
  const status = toolCallStatus(part.state)
  const verbs = TOOL_VERBS[getToolName(part)] ?? FALLBACK_VERBS
  const target = toolCallTarget(part.input)

  return (
    <Marker
      className={cn("w-fit", status === "failed" && "text-destructive")}
      title={part.state === "output-error" ? part.errorText : undefined}
    >
      <MarkerIcon>
        {status === "active" ? (
          <Spinner />
        ) : status === "done" ? (
          <CheckIcon />
        ) : (
          <CircleAlertIcon />
        )}
      </MarkerIcon>
      <MarkerContent>
        {status === "active" ? verbs.active : verbs.done}
        {target && <span className="ml-1 text-foreground">{target}</span>}
        {status === "failed" && " — failed"}
      </MarkerContent>
    </Marker>
  )
}

function toolCallStatus(
  state: ToolUIPart["state"] | DynamicToolUIPart["state"]
): "active" | "done" | "failed" {
  switch (state) {
    case "output-available":
      return "done"
    case "output-error":
    case "output-denied":
      return "failed"
    default:
      return "active"
  }
}

const TOOL_VERBS: Record<string, { active: string; done: string }> = {
  read_file: { active: "Reading", done: "Read" },
  write_file: { active: "Writing", done: "Wrote" },
  replace_text: { active: "Editing", done: "Edited" },
  list_files: { active: "Listing files", done: "Listed files" },
  delete_file: { active: "Deleting", done: "Deleted" },
  [ASK_PLAYER]: { active: "Asking", done: "Asked" },
}

const FALLBACK_VERBS = { active: "Working", done: "Ran tool" }

function toolCallTarget(input: unknown): string | undefined {
  if (typeof input !== "object" || input === null || !("path" in input)) {
    return undefined
  }

  const { path } = input as { path?: unknown }

  return typeof path === "string" && path !== "" ? path : undefined
}

const ASK_ITEM = "answer"

const ASK_DIMENSIONS: Record<string, string> = {
  loop: "the core loop",
  goal: "the goal",
  challenge: "the challenge",
  controls: "the controls",
  world: "the world",
  look: "the look",
  feel: "the feel",
}

type AskPlayerOption = { id: string; label: string; description?: string }

function AskPlayerCard({
  part,
  onAnswer,
}: {
  part: ToolUIPart | DynamicToolUIPart
  onAnswer?: (option: AskPlayerOption) => void
}) {
  const asked = askPlayerInput(part.input)

  if (!asked || part.state === "input-streaming") {
    return <ToolCallMarker part={part} />
  }

  if (part.state === "output-error" || part.state === "output-denied") {
    return <ToolCallMarker part={part} />
  }

  const dimension = asked.dimension && ASK_DIMENSIONS[asked.dimension]
  const answered =
    part.state === "output-available" ? askPlayerAnswer(part.output) : undefined

  return (
    <div className="flex w-full max-w-md flex-col gap-3">
      <Marker>
        <MarkerIcon>
          <CircleQuestionMarkIcon />
        </MarkerIcon>
        <MarkerContent>
          {dimension ? `A question about ${dimension}` : "A question"}
        </MarkerContent>
      </Marker>

      {onAnswer && part.state === "input-available" ? (
        <Questionnaire
          shortcuts="letters"
          onSubmit={(event) => {
            event.preventDefault()

            const picked = new FormData(event.currentTarget).get(ASK_ITEM)
            const option = asked.options.find(({ id }) => id === picked)

            if (option) {
              onAnswer(option)
            }
          }}
        >
          <QuestionnaireItem name={ASK_ITEM} required>
            <QuestionnaireTitle>{asked.question}</QuestionnaireTitle>
            <QuestionnaireChoices>
              {asked.options.map((option) => (
                <QuestionnaireChoice key={option.id} value={option.id}>
                  {option.label}
                  {option.description && (
                    <QuestionnaireChoiceDescription>
                      {option.description}
                    </QuestionnaireChoiceDescription>
                  )}
                </QuestionnaireChoice>
              ))}
            </QuestionnaireChoices>
            <QuestionnaireError />
          </QuestionnaireItem>
          <QuestionnaireActions>
            <QuestionnaireSubmit size="sm">Build this</QuestionnaireSubmit>
          </QuestionnaireActions>
        </Questionnaire>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="font-heading text-base leading-snug font-medium text-pretty">
            {asked.question}
          </p>
          <Marker>
            <MarkerIcon>
              {answered ? <CheckIcon /> : <CircleAlertIcon />}
            </MarkerIcon>
            <MarkerContent>
              {answered ? (
                <span className="text-foreground">{answered}</span>
              ) : (
                "Left unanswered"
              )}
            </MarkerContent>
          </Marker>
        </div>
      )}
    </div>
  )
}

function askPlayerInput(input: unknown): {
  dimension?: string
  question: string
  options: AskPlayerOption[]
} | null {
  if (typeof input !== "object" || input === null) {
    return null
  }

  const { dimension, question, options } = input as {
    dimension?: unknown
    question?: unknown
    options?: unknown
  }

  if (typeof question !== "string" || question === "") {
    return null
  }

  const parsed = (Array.isArray(options) ? options : []).flatMap(
    (option): AskPlayerOption[] => {
      if (typeof option !== "object" || option === null) {
        return []
      }

      const { id, label, description } = option as {
        id?: unknown
        label?: unknown
        description?: unknown
      }

      if (typeof id !== "string" || id === "" || typeof label !== "string") {
        return []
      }

      return [
        {
          id,
          label,
          description:
            typeof description === "string" ? description : undefined,
        },
      ]
    }
  )

  if (parsed.length < 2) {
    return null
  }

  return {
    dimension: typeof dimension === "string" ? dimension : undefined,
    question,
    options: parsed,
  }
}

function askPlayerAnswer(output: unknown): string | undefined {
  if (typeof output !== "object" || output === null) {
    return undefined
  }

  const { label } = output as { label?: unknown }

  return typeof label === "string" && label !== "" ? label : undefined
}
