#!/usr/bin/env bash
#
# Negative controls for the spotlighting fence assertion.
#
# The test in test/tools/prompt-techniques.test.ts asserts that the untrusted-content
# fence carries at least 32 bits and differs across calls. A passing test proves nothing
# on its own — it has to be shown to FAIL when the property it guards is broken, or it is
# decoration that reports success identically to a real check.
#
# So: break untrustedFence() three ways in the REAL source, run the REAL suite, and
# confirm which cases the test rejects. Patching a copy would exercise nothing while
# reporting the same green.
#
# Expected:
#   narrowed to 24 bits   FAIL   (width bound catches it; distinctness alone would not)
#   constant fence        FAIL   (distinctness catches it; width bound alone would not)
#   widened to 64 bits    PASS   (a lower bound must not punish an improvement)
#
# The first two rows are why both assertions exist: each catches what the other misses.
#
# Usage: ./scripts/fence-controls.sh      (from the repo root; restores the source after)

set -uo pipefail
cd "$(dirname "$0")/.."

SRC="src/prompt-engineer-lite.ts"
BAK="$(mktemp -t fence-controls)"
# Double quotes around "hex" — match the source exactly. This string is compared with
# grep -F and patched by exact replacement, so quote STYLE is load-bearing: a formatter
# run that flips ' to " turns these controls into a hard refusal (which is the safe
# direction, but it means the controls silently stop running until someone looks).
GOOD='return `UNTRUSTED_${randomBytes(4).toString("hex").toUpperCase()}`;'

# Populate the backup BEFORE arming the trap. mktemp creates the file empty, so a trap
# armed first would, on an interrupt in that window, restore an EMPTY file over the source
# and destroy any uncommitted work in it. Tiny window, total loss.
cp "$SRC" "$BAK"

SRC_HASH="$(shasum -a 256 "$BAK" | cut -d' ' -f1)"

# EVERY restore goes through this one function — the trap and the per-case restore alike.
# Guarding only the trap protects nothing: the per-case restore runs after each control,
# long before the trap ever fires, so an unguarded `cp` there truncates the target first.
#
# The guard is on the backup's HASH, not its existence or size. `[ -f ]` is satisfied by
# exactly the empty file that does the damage, and `-s` still accepts a partial copy.
#
# On mismatch it REFUSES and keeps the backup. Direction matters: refusing leaves a visible
# defect in a file, which is recoverable; restoring from a bad backup silently destroys
# uncommitted work, which is not. This script's target is uncommitted source, not something
# a generator can rebuild.
restore() {
  if [ "$(shasum -a 256 "$BAK" 2>/dev/null | cut -d' ' -f1)" = "$SRC_HASH" ]; then
    cp "$BAK" "$SRC"
    return 0
  fi
  echo "FATAL: backup at $BAK no longer matches what was saved — refusing to restore."
  echo "       $SRC may still hold a deliberately broken fence. Recover with:"
  echo "         git diff $SRC        # inspect"
  echo "         git checkout $SRC    # discard ALL uncommitted changes to it"
  echo "       Backup kept for inspection."
  return 1
}

cleanup() { restore || true; [ -f "$BAK" ] && [ "$RESTORE_OK" = yes ] && rm -f "$BAK"; return 0; }
RESTORE_OK=yes
trap cleanup EXIT INT TERM   # an interrupted run must never leave the defect in the tree

if ! grep -qF "$GOOD" "$SRC"; then
  echo "FATAL: untrustedFence() does not match the expected implementation."
  echo "       These controls patch it by exact string; update GOOD in this script."
  exit 2
fi

control() {
  local replacement="$1" label="$2" expect="$3"
  REPL="$replacement" python3 -c '
import os, sys
p, good = sys.argv[1], sys.argv[2]
s = open(p).read()
assert good in s
open(p, "w").write(s.replace(good, os.environ["REPL"]))
' "$SRC" "$GOOD"

  # Capture, THEN grep. `npm test | grep -q` looks equivalent but is not: grep -q exits on
  # first match, npm takes SIGPIPE, and `set -o pipefail` reports the pipeline as failed —
  # so a control that DID detect the defect is recorded as having passed. That inverts
  # every row silently, which is worse than no controls at all.
  local out got
  out="$(npm test -- prompt-techniques 2>&1)"
  if grep -qE "✕ the tag carries" <<<"$out"; then got=FAIL; else got=PASS; fi

  # Through the guard, never a bare cp — this is the caller that runs first and would
  # otherwise truncate the target before the trap's guard ever had a chance to matter.
  if ! restore; then RESTORE_OK=no; exit 2; fi

  printf '  %-22s %-6s' "$label" "$got"
  if [ "$got" = "$expect" ]; then echo "ok"; else echo "UNEXPECTED (wanted $expect)"; FAILED=1; fi
}

FAILED=0
echo "fence negative controls — patching $SRC, running the real suite"
control 'return `UNTRUSTED_${randomBytes(3).toString("hex").toUpperCase()}`;' "narrowed to 24 bits" FAIL
control 'return `UNTRUSTED_DEADBEEF`;'                                        "constant fence"      FAIL
control 'return `UNTRUSTED_${randomBytes(8).toString("hex").toUpperCase()}`;' "widened to 64 bits"  PASS

if ! diff -q "$BAK" "$SRC" >/dev/null; then
  echo "FATAL: source not restored cleanly — check $SRC before committing."
  exit 2
fi
echo "  source restored byte-identical"

if [ "$FAILED" -ne 0 ]; then
  echo "controls did NOT behave as documented — the fence assertion is not guarding what it claims"
  exit 1
fi
echo "all controls behaved as documented"
