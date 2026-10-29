#!/bin/bash
# spec/005 section 2.6's 7 positive controls, run INSIDE the agent carrier
# at the start of every run. Every item below must fail, or scan empty;
# the caller (the trusted runner process, outside this container) treats
# any unexpected pass as exit 5 -- no unattended run, no merge.
#
# This script only prints PASS/FAIL per control; it does not itself decide
# exit 5 vs proceed -- that decision, and the "exit 5 means stop" behavior,
# belongs to the runner that invokes this script and reads its output.
set -u
fail=0

check() {
  local label="$1"
  local got_status="$2"
  local expect="$3" # "nonzero" or "zero"
  if [ "$expect" = "nonzero" ]; then
    if [ "$got_status" -ne 0 ]; then
      echo "PASS: $label (failed as required, exit=$got_status)"
    else
      echo "FAIL: $label (unexpectedly succeeded)"
      fail=1
    fi
  else
    if [ "$got_status" -eq 0 ]; then
      echo "PASS: $label"
    else
      echo "FAIL: $label (exit=$got_status)"
      fail=1
    fi
  fi
}

echo "=== 1. gh auth status / git credential fill must fail ==="
if command -v gh >/dev/null 2>&1; then
  gh auth status >/dev/null 2>&1
  check "gh auth status" "$?" nonzero
else
  echo "PASS: gh auth status (gh is not even installed)"
fi
printf 'protocol=https\nhost=github.com\n\n' | git credential fill >/dev/null 2>&1
check "git credential fill" "$?" nonzero

echo "=== 2. executing a host binary via interop must be impossible ==="
if command -v cmd.exe powershell.exe gh.exe cmdkey >/dev/null 2>&1; then
  echo "FAIL: a host binary is reachable"
  fail=1
else
  echo "PASS: no host binary is reachable"
fi

echo "=== 3. reading host mounts / docker socket must fail ==="
ls /mnt/c >/dev/null 2>&1
check "read /mnt/c" "$?" nonzero
test -S /var/run/docker.sock
check "docker socket present" "$?" nonzero

echo "=== 4. outbound to any non-allowlisted host, including api.github.com, must fail ==="
node -e '
const { connect } = require("net");
const s = connect({ host: "api.github.com", port: 443, timeout: 4000 });
s.on("connect", () => process.exit(0));
s.on("timeout", () => process.exit(1));
s.on("error", () => process.exit(1));
' >/dev/null 2>&1
check "direct connect to api.github.com" "$?" nonzero

echo "=== 5. reading outside the worktree must fail ==="
ls /root >/dev/null 2>&1
check "read /root" "$?" nonzero

echo "=== 6. no credential-shaped env var besides the dedicated API key ==="
# GH_CONFIG_DIR is a sanctioned exception: spec/005 section 2.6 itself
# requires it, to redirect gh's own config lookup to an empty directory --
# it is a path, not a credential, and its target is checked separately
# below for actually being empty.
leaked=$(env | grep -E '(TOKEN|SECRET|PASSWORD)' | grep -v '^ANTHROPIC_API_KEY=' || true)
leaked="${leaked}$(env | grep -E '^(GH_|GITHUB_)' | grep -v '^GH_CONFIG_DIR=' || true)"
leaked="${leaked}$(env | grep -E 'KEY' | grep -v '^ANTHROPIC_API_KEY=' || true)"
if [ -n "$leaked" ]; then
  echo "FAIL: credential-shaped env var(s) present:"
  echo "$leaked"
  fail=1
else
  echo "PASS: no credential-shaped env var besides ANTHROPIC_API_KEY"
fi
if [ -n "${GH_CONFIG_DIR:-}" ] && [ -d "$GH_CONFIG_DIR" ]; then
  gh_contents=$(ls -A "$GH_CONFIG_DIR" 2>/dev/null || true)
  if [ -z "$gh_contents" ]; then
    echo "PASS: GH_CONFIG_DIR ($GH_CONFIG_DIR) is empty"
  else
    echo "FAIL: GH_CONFIG_DIR is not empty: $gh_contents"
    fail=1
  fi
fi

echo "=== 7. MCP tool list must be empty ==="
mcp_output=$(claude mcp list 2>&1)
if echo "$mcp_output" | grep -qi "no mcp servers configured"; then
  echo "PASS: MCP tool list is empty"
else
  echo "FAIL: MCP servers appear configured: $mcp_output"
  fail=1
fi

exit $fail
