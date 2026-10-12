import { appendFileSync } from "node:fs"

/**
 * Build a best-effort logger from plugin options. Logging is off unless
 * `options.log` is set, so the plugin stays quiet by default.
 *
 * - `{ "log": true }`      → log to stdout (console)
 * - `{ "log": "/path.log" }` → log to stdout and append to the file
 */
export function createLogger(options: unknown): (...parts: unknown[]) => void {
  const log = (options as { log?: boolean | string } | undefined)?.log
  if (!log) return () => {}

  const file = typeof log === "string" ? log : undefined
  return (...parts) => {
    const line = `${new Date().toISOString()} [guard.ssh] ${parts
      .map((part) => (typeof part === "string" ? part : JSON.stringify(part)))
      .join(" ")}`
    console.log(line)
    if (!file) return
    try {
      appendFileSync(file, line + "\n")
    } catch {
      // Logging must never break enforcement.
    }
  }
}
