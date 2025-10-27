# Shell Environment Hanging Analysis

## Root Cause Identified

Your commands are hanging because of **zsh login shell initialization**, NOT oh-my-zsh or powerlevel10k.

## The Problem: Zsh Startup File Loading Order

When you run `zsh -lc 'command'` or `bash -lc 'zsh ...'`, zsh loads files in this order:

1. **~/.zshenv** (ALWAYS loaded, even for non-interactive shells)
   - Your file: `. "$HOME/.cargo/env"` 
   - This sources Rust's cargo environment setup

2. **~/.zprofile** (loaded for LOGIN shells with `-l` flag)
   - Your file contains:
     - `eval "$(/opt/homebrew/bin/brew shellenv)"` ← **HANGS HERE**
     - `/usr/libexec/java_home` commands ← **Can also hang**

3. **~/.zshrc** (loaded for INTERACTIVE shells)
   - Your file has: `[[ $- != *i* ]] && return` ← **Never reached because .zprofile hangs first!**

## Why Commands Hang

### Command 1: `zsh -lc 'command'`
- The `-l` flag makes it a LOGIN shell
- Zsh loads ~/.zprofile BEFORE ~/.zshrc
- `eval "$(/opt/homebrew/bin/brew shellenv)"` in .zprofile executes
- The `eval` with subshell waits for input/locks in non-interactive context
- Never reaches your guard in .zshrc

### Command 2: `bash -lc 'some zsh command'`
- bash's `-l` sources bash login files
- If those files call zsh with `-l`, same problem as above
- Compounds the hanging issue

### Command 3: `curl`, `node`, subprocess I/O
- When launched from a hanging shell context
- They inherit the blocked state
- Terminal I/O buffering issues
- Process never completes

## Why Your Guard Didn't Work

Your .zshrc has this guard (which is correct):
```bash
[[ $- != *i* ]] && return
```

But it's in the WRONG file. It needs to be in **~/.zprofile** (and possibly ~/.zshenv) because those are sourced BEFORE .zshrc for login shells.

## Solution Strategy

### Option 1: Guard in .zprofile (Recommended)
Add the same guard at the TOP of ~/.zprofile:

```bash
# ~/.zprofile — login shell (env & PATH), macOS

# Exit immediately for non-interactive shells
[[ $- != *i* ]] && return

# ... rest of your .zprofile ...
eval "$(/opt/homebrew/bin/brew shellenv)"
# etc.
```

This prevents .zprofile from loading brew/java in non-interactive contexts.

### Option 2: Guard in .zshenv (More Aggressive)
Add guard at the TOP of ~/.zshenv:

```bash
# Exit immediately for non-interactive shells
[[ $- != *i* ]] && return

. "$HOME/.cargo/env"
```

This prevents cargo env from loading in non-interactive contexts.

### Option 3: Use Non-Login Shells in Commands (Workaround)
Instead of `bash -lc` or `zsh -lc`, use:
- `bash -c` (no login flag)
- `zsh -c` (no login flag)
- Direct commands without shell wrappers

Example:
```bash
# Bad (hangs)
bash -lc 'curl http://localhost:3000'

# Good (works)
bash -c 'curl http://localhost:3000'

# Even better (no shell wrapper)
curl http://localhost:3000
```

### Option 4: Isolated Environment (Nuclear Option)
Use `env -i` to strip environment:

```bash
env -i PATH="$PATH" HOME="$HOME" TERM=xterm-256color \
  zsh -c 'your command'
```

This bypasses all shell configs entirely.

## What This Means for Cascade/AI Agents

IDE-based AI agents often run commands in non-interactive, non-login shells. When they encounter login shell configs that:
- Run `eval` with subshells
- Call external programs (java_home, brew shellenv)
- Set up prompts (p10k instant prompt)
- Initialize complex frameworks

These can hang waiting for:
- Terminal input (none available)
- Display output (no TTY)
- User interaction (no user)
- File locks (other shells using same cache)

## Recommended Fix for Your Setup

1. **Add guard to ~/.zprofile** (top of file):
```bash
# Exit immediately for non-interactive shells
[[ $- != *i* ]] && return
```

2. **Add guard to ~/.zshenv** (top of file):
```bash
# Exit immediately for non-interactive shells
[[ $- != *i* ]] && return
```

3. **Keep existing guard in ~/.zshrc** (you already have this)

4. **Test it works**:
```bash
# Should print "OK" immediately (no hang)
timeout 2 zsh -lc 'echo OK'

# Should also work
timeout 2 bash -lc 'zsh -lc "echo OK"'
```

## Why oh-my-zsh/powerlevel10k Were Not the Problem

Your .zshrc has:
- `POWERLEVEL9K_INSTANT_PROMPT=quiet` (correct)
- `[[ $- != *i* ]] && return` BEFORE oh-my-zsh loads (correct)

So oh-my-zsh and p10k never get loaded in non-interactive shells. The problem was .zprofile running BEFORE .zshrc.

## Verification After Fix

After adding guards to .zprofile and .zshenv:

```bash
# Test 1: Non-interactive zsh (should exit immediately)
time zsh -c 'echo OK'
# Expected: <0.1s

# Test 2: Login shell (should exit immediately)
time zsh -lc 'echo OK'
# Expected: <0.1s

# Test 3: Nested bash + zsh
time bash -lc 'zsh -lc "echo OK"'
# Expected: <0.2s

# Test 4: Verify interactive still works
zsh -i -c 'echo $ZSH_THEME'
# Expected: prints "powerlevel10k/powerlevel10k"
```

## Commands That Should Work After Fix

All these will work without hanging:

```bash
# Cascade/AI agent commands
bash -lc 'set -euo pipefail; npm --prefix clear-my-day run dev & ...'

# curl with timeouts
curl --max-time 10 http://localhost:3000/api/health

# Node subprocess
node -e 'console.log("OK")'

# Background processes
(npm run dev > log 2>&1 & echo $! > pid)

# Complex multi-line commands
bash -lc 'set -euo pipefail
  TOKEN=$(curl ...)
  ./test/ics-verify.sh audit_all "$TOKEN"
'
```

## Summary

- **Problem:** .zprofile's `eval "$(/opt/homebrew/bin/brew shellenv)"` hangs in non-interactive login shells
- **Why:** Login shells load .zprofile BEFORE .zshrc, so .zshrc's guard never runs
- **Fix:** Add `[[ $- != *i* ]] && return` to TOP of ~/.zprofile and ~/.zshenv
- **Result:** Non-interactive shells exit immediately, commands don't hang

This is a common issue when using oh-my-zsh/p10k with AI agents, but ironically your .zshrc was already configured correctly. The fix just needs to be applied to the login shell config files too.
