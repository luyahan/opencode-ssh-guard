# opencode-ssh-guard

An OpenCode V2 plugin that intercepts and denies reads of the user's SSH
directory (`~/.ssh`).

Most permission rules match the path *relative to the worktree*, so an absolute
read of `~/.ssh/...` from outside the home directory can slip through. This
plugin resolves the real path (via `os.homedir()`) at hook time and blocks it.

## Behavior

Two independent layers:

1. **Permission layer** (`ctx.permission.hook("evaluate")`) — denies `read`,
   `edit`, `external_directory`, and any other action whose resource resolves
   under `~/.ssh`, plus `shell` commands that reference `~/.ssh`.
2. **Tool layer** (`ctx.tool.hook("execute.before")`) — throws inside
   `read` / `grep` / `glob` when the target path is under `~/.ssh`, so it still
   blocks even if the permission config is changed.

## Install

From GitHub:

```sh
opencode plugin add 'github:luyahan/opencode-ssh-guard'
```

Or drop `src/index.ts` into a local plugin directory:

```text
~/.config/opencode/plugins/ssh-guard/index.ts
```

`opencode plugin list` should then show an entry with id `guard.ssh`.

## Disable

Add `-guard.ssh` to `plugins` in `opencode.jsonc`, or delete the plugin file.

## License

MIT
