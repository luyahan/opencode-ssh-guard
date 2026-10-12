import { test } from "node:test"
import assert from "node:assert/strict"
import { homedir } from "node:os"
import { join, resolve } from "node:path"
import { SSH_DIR, SSH_IN_COMMAND, extractPaths, isSshPath, toAbsolute } from "../src/guard.ts"

const HOME = homedir()

test("blocks the SSH directory itself and files inside it", () => {
  assert.equal(isSshPath(SSH_DIR), true)
  assert.equal(isSshPath(join(SSH_DIR, "config")), true)
  assert.equal(isSshPath(join(SSH_DIR, "keys", "id_ed25519")), true)
  assert.equal(isSshPath("~/.ssh"), true)
  assert.equal(isSshPath("~/.ssh/id_rsa"), true)
  assert.equal(isSshPath(".ssh/config"), true)
  assert.equal(isSshPath("./.ssh/config"), true)
})

test("does not block look-alike names or unrelated paths", () => {
  assert.equal(isSshPath(join(HOME, "projects", ".sshrc")), false)
  assert.equal(isSshPath(join(HOME, ".ssh_backup", "config")), false)
  assert.equal(isSshPath("/tmp/.ssh_test/x"), false)
  assert.equal(isSshPath("my.ssh"), false)
  assert.equal(isSshPath(join(HOME, "notes.md")), false)
  assert.equal(isSshPath(""), false)
  assert.equal(isSshPath(undefined), false)
  assert.equal(isSshPath(42), false)
})

test("extracts candidate paths from tool input", () => {
  assert.deepEqual(extractPaths({ filePath: "/a" }), ["/a"])
  assert.deepEqual(extractPaths({ file_path: "/a" }), ["/a"])
  assert.deepEqual(extractPaths({ path: "/d", paths: ["/b", "/c"] }), ["/d", "/b", "/c"])
  assert.deepEqual(extractPaths({ pattern: "x" }), [])
  assert.deepEqual(extractPaths(null), [])
  assert.deepEqual(extractPaths("nope"), [])
})

test("expands ~ correctly", () => {
  assert.equal(toAbsolute("~"), HOME)
  assert.equal(toAbsolute("~/x"), resolve(HOME, "x"))
})

test("detects SSH references in shell commands", () => {
  assert.equal(SSH_IN_COMMAND.test("cat ~/.ssh/config"), true)
  assert.equal(SSH_IN_COMMAND.test("scp /Users/x/.ssh/id_rsa remote:"), true)
  assert.equal(SSH_IN_COMMAND.test("grep -r key .ssh/"), true)
  assert.equal(SSH_IN_COMMAND.test("ls ~/.ssh"), true)

  assert.equal(SSH_IN_COMMAND.test("echo .sshfoo"), false)
  assert.equal(SSH_IN_COMMAND.test("ls /tmp/.ssh_test"), false)
  assert.equal(SSH_IN_COMMAND.test("echo hello"), false)
  assert.equal(SSH_IN_COMMAND.test("cat notes.md"), false)
})
