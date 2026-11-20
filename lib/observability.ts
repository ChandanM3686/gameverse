type Attributes = Record<string, unknown>

function write(level: "debug" | "info" | "warn" | "error") {
  return (message: string, attributes?: Attributes) => {
    if (level === "debug" && process.env.NODE_ENV === "production") return
    const line = `[gameverse] ${level.toUpperCase()} ${message}`
    if (attributes && Object.keys(attributes).length > 0) {
      console[level](line, attributes)
    } else {
      console[level](line)
    }
  }
}

export const logger = {
  debug: write("debug"),
  info: write("info"),
  warn: write("warn"),
  error: write("error"),
  fmt: (strings: TemplateStringsArray, ...values: unknown[]) =>
    String.raw({ raw: strings }, ...values.map(String)),
}

export function describeError(error: unknown): {
  "exception.type": string
  "exception.message": string
} {
  return {
    "exception.type": error instanceof Error ? error.name : typeof error,
    "exception.message": error instanceof Error ? error.message : String(error),
  }
}

export function elapsed(start: number): number {
  return Math.round(performance.now() - start)
}
