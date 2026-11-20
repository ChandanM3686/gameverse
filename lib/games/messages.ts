import "server-only"

import { createIdGenerator } from "ai"

export const generateMessageId = createIdGenerator({ prefix: "msg", size: 16 })
