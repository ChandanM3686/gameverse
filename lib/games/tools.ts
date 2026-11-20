import path from "node:path"

import { tool } from "ai"
import { z } from "zod"

import {
  deleteFileRows,
  getFileRow,
  listFileRows,
  putFileRow,
} from "@/lib/db/client"
import { ensureGameWorkspace, GAME_DIR } from "@/lib/workspace/local"
import { describeError, elapsed, logger } from "@/lib/observability"

const SAFE_PATH = /^[a-zA-Z0-9._/-]+$/

const MAX_FILE_BYTES = 128_000

const LIST_DEPTH = 5

const askPlayer = tool({
  description:
    "Put one design question to the player and wait for their answer. Use it to settle a part of the game they haven't decided yet — on the opening turn, to work out what the game actually is before writing any of it. One question per call: the turn stops here until they pick, then carries on, so ask the next one after this answer rather than folding several into one.",
  inputSchema: z.object({
    dimension: z
      .enum(["loop", "goal", "challenge", "controls", "world", "look", "feel"])
      .describe(
        [
          "The part of the game the question is about. Choose it first, then write a question that stays inside it.",
          "- loop: the action the player repeats — what they are doing second to second.",
          "- goal: what they are playing towards — winning, losing, scoring, progressing.",
          "- challenge: what stands in their way, and how hard it pushes.",
          "- controls: what they press, and how the game answers.",
          "- world: setting, theme, and how the space is laid out.",
          "- look: art direction — style, palette, camera, scale.",
          "- feel: pace, weight, juice and sound.",
        ].join("\n")
      ),
    question: z
      .string()
      .describe(
        "The question, in one sentence and in the player's terms — what the game would be, not how it would be built."
      ),
    options: z
      .array(
        z.object({
          id: z
            .string()
            .describe(
              'A short lowercase identifier for the option, unique within this question, e.g. "twin-stick".'
            ),
          label: z
            .string()
            .describe("The option in a few words, the way a button reads."),
          description: z
            .string()
            .describe(
              "One sentence on what picking this would mean for the game."
            ),
        })
      )
      .min(2)
      .max(4)
      .describe(
        "The answers to choose between. Each one a different game you would be happy to build — no filler option, and nothing that asks them to write the answer themselves."
      ),
  }),
  outputSchema: z.object({
    optionId: z.string().describe("The id of the option the player picked."),
    label: z.string().describe("The label of the option the player picked."),
  }),
})

export function createGameTools(gameId: string) {
  let pending: Promise<Workspace> | undefined

  const sandbox = () => {
    pending ??= ensureGameWorkspace(gameId)
      .then(() => new Workspace(gameId))
      .catch((error: unknown) => {
        pending = undefined

        logger.error(logger.fmt`Could not get a sandbox for game ${gameId}`, {
          "game.id": gameId,
          ...describeError(error),
        })

        throw error
      })

    return pending
  }

  return {
    read_file: tool({
      description:
        "Read a file from the game directory. Read a file before editing it — what is on disk is what the player is running, including everything written on earlier turns.",
      inputSchema: z.object({
        path: z
          .string()
          .describe(
            'Path relative to the game directory, e.g. "index.html" or "src/player.js".'
          ),
      }),
      execute: ({ path: filePath }) =>
        expected("read_file", gameId, filePath, async () => {
          const target = resolveGamePath(filePath)
          const box = await sandbox()
          const info = await statFile(box, target)

          if (!info) {
            return `No file at ${relative(target)}.`
          }

          if (info.isDir) {
            return `${relative(target)} is a directory. Use list_files to see what is in it.`
          }

          if (info.size > MAX_FILE_BYTES) {
            return `${relative(target)} is ${info.size} bytes, over the ${MAX_FILE_BYTES} byte read limit. Split it into smaller modules.`
          }

          return box.read(target)
        }),
    }),

    write_file: tool({
      description:
        "Write a file in the game directory, creating it or replacing its contents whole. Missing parent directories are created. Use replace_text instead when changing part of an existing file.",
      inputSchema: z.object({
        path: z
          .string()
          .describe(
            'Path relative to the game directory, e.g. "index.html" or "src/player.js".'
          ),
        content: z
          .string()
          .describe("The complete contents of the file, not a fragment."),
      }),
      execute: ({ path: filePath, content }) =>
        expected("write_file", gameId, filePath, async () => {
          const target = resolveGamePath(filePath)

          if (Buffer.byteLength(content, "utf8") > MAX_FILE_BYTES) {
            return `That content is over the ${MAX_FILE_BYTES} byte write limit. Split the file into smaller modules.`
          }

          const box = await sandbox()

          await box.write(target, content)

          return `Wrote ${relative(target)} (${lineCount(content)} lines).`
        }),
    }),

    replace_text: tool({
      description:
        "Replace an exact snippet of text in a file in the game directory. Prefer this over write_file for changes that touch part of a file, so the rest of the game stays exactly as it is.",
      inputSchema: z.object({
        path: z
          .string()
          .describe("Path to the file, relative to the game directory."),
        find: z
          .string()
          .describe(
            "The exact text to replace, including its indentation and line breaks. Must appear exactly once in the file unless replace_all is true — include the surrounding lines to make a short snippet unique."
          ),
        replace: z
          .string()
          .describe(
            "The text to put in its place. An empty string deletes the snippet."
          ),
        replace_all: z
          .boolean()
          .optional()
          .describe(
            "Replace every occurrence instead of requiring exactly one. Use for renames."
          ),
      }),
      execute: ({ path: filePath, find, replace, replace_all: replaceAll }) =>
        expected("replace_text", gameId, filePath, async () => {
          const target = resolveGamePath(filePath)

          if (find === "") {
            return "find cannot be empty — pass the exact text to replace."
          }

          const box = await sandbox()
          const info = await statFile(box, target)

          if (!info || info.isDir) {
            return `No file at ${relative(target)}.`
          }

          if (info.size > MAX_FILE_BYTES) {
            return `${relative(target)} is ${info.size} bytes, over the ${MAX_FILE_BYTES} byte limit. Split it into smaller modules.`
          }

          const content = await box.read(target)
          const parts = content.split(find)
          const occurrences = parts.length - 1

          if (occurrences === 0) {
            return `That text isn't in ${relative(target)}. Read the file and copy the snippet exactly, including indentation.`
          }

          if (occurrences > 1 && !replaceAll) {
            return `That text appears ${occurrences} times in ${relative(target)}. Include the surrounding lines to pick one out, or set replace_all to change them all.`
          }

          const updated = replaceAll
            ? parts.join(replace)
            : content.replace(find, () => replace)

          await box.write(target, updated)

          return `Replaced ${occurrences === 1 ? "1 occurrence" : `${occurrences} occurrences`} in ${relative(target)}.`
        }),
    }),

    list_files: tool({
      description:
        "List the files in the game directory. Use it at the start of a turn to see what the game is made of before changing it.",
      inputSchema: z.object({
        path: z
          .string()
          .optional()
          .describe(
            "Subdirectory to list, relative to the game directory. Defaults to the whole game directory."
          ),
      }),
      execute: ({ path: filePath }) =>
        expected("list_files", gameId, filePath, async () => {
          const target = resolveGamePath(filePath ?? ".", { allowRoot: true })
          const box = await sandbox()

          if (target !== GAME_DIR && !(await statFile(box, target))) {
            return `No directory at ${relative(target)}.`
          }

          const files = (await box.list(target, LIST_DEPTH)).sort((a, b) =>
            a.path.localeCompare(b.path)
          )

          if (files.length === 0) {
            return target === GAME_DIR
              ? "The game directory is empty."
              : `${relative(target)} has no files in it.`
          }

          return files
            .map((file) => `${file.path} (${file.size} bytes)`)
            .join("\n")
        }),
    }),

    delete_file: tool({
      description:
        "Delete a file or directory from the game directory. Only for files the game no longer uses — deleting index.html leaves the preview with nothing to load.",
      inputSchema: z.object({
        path: z
          .string()
          .describe(
            "Path to the file or directory to delete, relative to the game directory."
          ),
      }),
      execute: ({ path: filePath }) =>
        expected("delete_file", gameId, filePath, async () => {
          const target = resolveGamePath(filePath)
          const box = await sandbox()
          const info = await statFile(box, target)

          if (!info) {
            return `No file at ${relative(target)}.`
          }

          await box.remove(target)

          return info.isDir
            ? `Deleted ${relative(target)} and everything in it.`
            : `Deleted ${relative(target)}.`
        }),
    }),

    ask_player: askPlayer,
  }
}

export type GameTools = ReturnType<typeof createGameTools>

class ToolInputError extends Error {}

async function expected(
  tool: string,
  gameId: string,
  target: string | undefined,
  run: () => Promise<string>
): Promise<string> {
  const startedAt = performance.now()

  const attributes: Record<string, string | number | boolean> = {
    "gen_ai.operation.name": "execute_tool",
    "gen_ai.tool.name": tool,
    "game.id": gameId,
  }

  if (target !== undefined && target !== "") {
    attributes["code.file.path"] = target
  }

  try {
    const result = await run()

    logger.info(logger.fmt`Agent called ${tool}`, {
      ...attributes,
      duration_ms: elapsed(startedAt),
    })

    return result
  } catch (error) {
    if (error instanceof ToolInputError) {
      logger.warn(logger.fmt`Agent called ${tool} with unusable input`, {
        ...attributes,
        "tool.refusal": error.message,
        duration_ms: elapsed(startedAt),
      })

      return error.message
    }

    logger.error(logger.fmt`Agent's call to ${tool} failed`, {
      ...attributes,
      ...describeError(error),
      duration_ms: elapsed(startedAt),
    })

    throw error
  }
}

function resolveGamePath(
  input: string,
  { allowRoot = false }: { allowRoot?: boolean } = {}
): string {
  const trimmed = input.trim()

  if (trimmed === "") {
    throw new ToolInputError("path cannot be empty.")
  }

  if (!SAFE_PATH.test(trimmed)) {
    throw new ToolInputError(
      `"${trimmed}" isn't a usable path. Use letters, digits, dots, dashes, underscores and slashes only.`
    )
  }

  const resolved = path.posix.resolve(GAME_DIR, trimmed)

  if (resolved !== GAME_DIR && !resolved.startsWith(`${GAME_DIR}/`)) {
    throw new ToolInputError(
      `"${trimmed}" is outside the game directory. Every path is relative to ${GAME_DIR} and has to stay inside it.`
    )
  }

  if (resolved === GAME_DIR && !allowRoot) {
    throw new ToolInputError(
      "That is the game directory itself. Name a file inside it."
    )
  }

  return resolved
}

function relative(fullPath: string): string {
  return path.posix.relative(GAME_DIR, fullPath) || "."
}

class Workspace {
  constructor(private readonly gameId: string) {}

  async stat(virtualPath: string) {
    const key = relative(virtualPath)

    if (key === ".") {
      return { isDir: true, size: 0 }
    }

    const file = await getFileRow(this.gameId, key)

    if (file) {
      return { isDir: false, size: file.size }
    }

    const inside = await listFileRows(this.gameId, `${key}/`)

    return inside.length > 0 ? { isDir: true, size: 0 } : null
  }

  async read(virtualPath: string) {
    const file = await getFileRow(this.gameId, relative(virtualPath))
    return file?.content ?? ""
  }

  write(virtualPath: string, content: string) {
    return putFileRow(this.gameId, relative(virtualPath), content)
  }

  remove(virtualPath: string) {
    return deleteFileRows(this.gameId, relative(virtualPath))
  }

  async list(
    virtualPath: string,
    depth: number
  ): Promise<{ path: string; size: number }[]> {
    const key = relative(virtualPath)
    const prefix = key === "." ? "" : `${key}/`
    const rows = await listFileRows(this.gameId, prefix)

    return rows.filter(
      (row) => row.path.slice(prefix.length).split("/").length <= depth
    )
  }
}

async function statFile(box: Workspace, fullPath: string) {
  return box.stat(fullPath)
}

function lineCount(content: string): number {
  return content === "" ? 0 : content.split("\n").length
}
