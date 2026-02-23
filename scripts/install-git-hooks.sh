#!/usr/bin/env sh
set -eu

repo_root="$(git rev-parse --show-toplevel 2>/dev/null)"
if [ -z "$repo_root" ]; then
  echo "error: not inside a git repository" >&2
  exit 1
fi

hook_path="$repo_root/.githooks/pre-commit"
if [ ! -f "$hook_path" ]; then
  echo "error: expected hook at $hook_path" >&2
  exit 1
fi

chmod +x "$hook_path" || true
git -C "$repo_root" config core.hooksPath .githooks

echo "Installed git hooks: core.hooksPath=.githooks"

