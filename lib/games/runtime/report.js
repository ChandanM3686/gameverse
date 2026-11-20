;(function () {
  var PING = "game-ping"
  var STATUS = "game-status"

  var MAX_MESSAGE = 1000
  var MAX_STACK = 2000

  var firstError = null

  function clamp(value, limit) {
    var text = String(value)
    return text.length > limit ? text.slice(0, limit) + "…" : text
  }

  function record(report) {
    if (firstError) return
    firstError = report
  }

  function describe(error, message, source, line, column) {
    var thrown = error && typeof error === "object" ? error : null

    return {
      message: clamp(
        message || (thrown && thrown.message) || error || "Unknown error",
        MAX_MESSAGE
      ),
      source: source ? String(source) : "",
      line: typeof line === "number" ? line : null,
      column: typeof column === "number" ? column : null,
      stack: thrown && thrown.stack ? clamp(thrown.stack, MAX_STACK) : "",
    }
  }

  window.addEventListener(
    "error",
    function (event) {
      var target = event.target

      if (target && target !== window && (target.src || target.href)) {
        record(describe(null, "Failed to load " + (target.src || target.href)))
        return
      }

      record(
        describe(
          event.error,
          event.message,
          event.filename,
          event.lineno,
          event.colno
        )
      )
    },
    true
  )

  window.addEventListener("unhandledrejection", function (event) {
    var reason = event.reason
    var described = describe(reason)
    described.message = clamp(
      "Unhandled rejection: " + described.message,
      MAX_MESSAGE
    )
    record(described)
  })

  window.addEventListener("message", function (event) {
    var data = event.data
    if (!data || data.type !== PING) return

    var source = event.source || window.parent
    if (!source) return

    source.postMessage({ type: STATUS, error: firstError }, "*")
  })
})()
