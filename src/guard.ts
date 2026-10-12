import { homedir } from "node:os"
import { isAbsolute, resolve, sep } from "node:path"

// Real home directory (macOS: /Users/xxx, Linux: /home/xxx). Not hard-coded.
const HOME = homedir()
export const SSH_DIR = resolve(HOME, ".ssh")

/** Normalize "~", "~/", relative, or absolute input into an absolute path. */
export function toAbsolute(input: string): string {
  if (input === "~") return HOME
  if (input.startsWith("~/") || input.startsWith("~\\")) return resolve(HOME, input.slice(2))
  return isAbsolute(input) ? resolve(input) : resolve(process.cwd(), input)
}

/** Whether a value points at the SSH directory (or something inside it). */
export function isSshPath(input: unknown): boolean {
  if (typeof input !== "string") return false
  const raw = input.trim()
  if (!raw) return false

  // 1) Resolved absolute path under the SSH directory.
  const abs = toAbsolute(raw)
  if (abs === SSH_DIR || abs.startsWith(SSH_DIR + sep)) return true

  // 2) Case-insensitive filesystems (macOS, Windows).
  if (process.platform !== "linux") {
    const lowerAbs = abs.toLowerCase()
    const lowerSsh = SSH_DIR.toLowerCase()
    if (lowerAbs === lowerSsh || lowerAbs.startsWith(lowerSsh + sep)) return true
  }

  // 3) Worktree-relative paths (e.g. ".ssh/config") used by permission rules.
  const norm = raw.replaceAll("\\", "/")
  return (
    norm === ".ssh" ||
    norm.startsWith(".ssh/") ||
    norm === "~/.ssh" ||
    norm.startsWith("~/.ssh/") ||
    norm.includes("/.ssh/") ||
    norm.endsWith("/.ssh")
  )
}

/** Whether a shell command explicitly references the SSH directory. */
export const SSH_IN_COMMAND = /(?:^|[\s"'`(=:;|&/])~?\/?\.ssh(?:[/\s"'`)&:;|]|$)/

/** Pull every value that could be a path out of a tool's input object. */
export function extractPaths(input: unknown): unknown[] {
  if (!input || typeof input !== "object") return []
  const record = input as Record<string, unknown>
  const out: unknown[] = []
  for (const key of ["filePath", "file_path", "path", "paths", "filePaths"]) {
    const value = record[key]
    if (Array.isArray(value)) out.push(...value)
    else if (value !== undefined) out.push(value)
  }
  return out
}
