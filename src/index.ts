import { Plugin } from "@opencode/plugin"
import { SSH_DIR, SSH_IN_COMMAND, extractPaths, isSshPath } from "./guard"

export default Plugin.define({
  id: "guard.ssh",
  async setup(ctx) {
    // Layer 1: hard deny at the permission layer.
    // Any read / edit / external_directory access that resolves under the SSH
    // directory is denied, as are shell commands that reference it. This does
    // not depend on worktree-relative path matching.
    await ctx.permission.hook("evaluate", (event) => {
      const byPath = event.resources.some(isSshPath)
      const byShell =
        event.action === "shell" && event.resources.some((resource) => SSH_IN_COMMAND.test(resource))
      if (!byPath && !byShell) return
      event.effect = "deny"
      event.message = `访问 ${SSH_DIR} 已被 guard.ssh 插件拦截。`
    })

    // Layer 2: defense in depth at the tool layer (blocks read even if the
    // permission config is changed). Throwing from execute.before aborts the
    // tool call.
    await ctx.tool.hook("execute.before", (event) => {
      if (event.tool !== "read" && event.tool !== "grep" && event.tool !== "glob") return
      if (extractPaths(event.input).some(isSshPath)) {
        throw new Error(`访问 ${SSH_DIR} 已被 guard.ssh 插件拦截。`)
      }
    })
  },
})
