import { Plugin } from "@opencode/plugin"
import { homedir } from "node:os"
import { isAbsolute, resolve, sep } from "node:path"

// 真实家目录（macOS 上是 /Users/xxx，Linux 上是 /home/xxx），不写死路径。
const HOME = homedir()
const SSH_DIR = resolve(HOME, ".ssh")

/** 把 "~"、"~/"、相对路径或绝对路径规范化成绝对路径。 */
function toAbsolute(input: string): string {
  if (input === "~") return HOME
  if (input.startsWith("~/") || input.startsWith("~\\")) return resolve(HOME, input.slice(2))
  return isAbsolute(input) ? resolve(input) : resolve(process.cwd(), input)
}

/** 某个字符串是否指向 SSH 目录（含自身）。 */
function isSshPath(input: unknown): boolean {
  if (typeof input !== "string") return false
  const raw = input.trim()
  if (!raw) return false

  // 1) 规范化后落在 SSH 目录下
  const abs = toAbsolute(raw)
  if (abs === SSH_DIR || abs.startsWith(SSH_DIR + sep)) return true

  // 2) 权限规则用的是 worktree 相对路径（例如 ".ssh/config"），一并拦截
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

/** shell 命令里显式提到 SSH 目录的（cat/cp/scp ~/.ssh/... 之类）。 */
const SSH_IN_COMMAND = /(^|[\s"'`(=:;|&])~?\/?\.ssh(\/|\s|$|["'`)]|$)/

/** 从工具入参里取出所有可能是路径的值。 */
function extractPaths(input: unknown): unknown[] {
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

export default Plugin.define({
  id: "guard.ssh",
  async setup(ctx) {
    // 第 1 层：权限层硬拦截。
    // 任何解析后指向 SSH 目录的 read / edit / external_directory 访问一律拒绝；
    // shell 命令里显式出现的也拒绝。不依赖 worktree 相对路径规则。
    await ctx.permission.hook("evaluate", (event) => {
      const byPath = event.resources.some(isSshPath)
      const byShell =
        event.action === "shell" && event.resources.some((resource) => SSH_IN_COMMAND.test(resource))
      if (!byPath && !byShell) return
      event.effect = "deny"
      event.message = `访问 ${SSH_DIR} 已被 guard.ssh 插件拦截。`
    })

    // 第 2 层：工具层纵深防御（即使权限配置被改也能拦住 read）。
    // execute.before 里抛错即中止该工具调用。
    await ctx.tool.hook("execute.before", (event) => {
      if (event.tool !== "read" && event.tool !== "grep" && event.tool !== "glob") return
      if (extractPaths(event.input).some(isSshPath)) {
        throw new Error(`访问 ${SSH_DIR} 已被 guard.ssh 插件拦截。`)
      }
    })
  },
})
