# Workflow Progress Tracking - Live Session Logging

## Problem Solved

Long-running workflows (5-10 minutes with 7+ steps) previously showed no progress until completion. Users saw only "Tool ran without output or errors" during execution.

## Solution: SessionLogger Integration

We integrated the existing `SessionLogger` class into the workflow system to provide:
- **Real-time progress files** - Monitor workflow execution live
- **Persistent session logs** - Full markdown reports saved after completion
- **Step-by-step tracking** - Each step logs immediately after completion
- **Verbose console output** - Detailed progress in server logs

## How It Works

### 1. Automatic Session Logging

When you run any workflow, the system now:

1. **Creates a session** at workflow start:
   ```
   📝 Session log: .workflow-sessions/session-2025-10-18-02-15-30-workflow-creative-brainstorm-yaml.md
      To monitor progress: tail -f .workflow-sessions/session-2025-10-18-02-15-30-workflow-creative-brainstorm-yaml.md
   ```

2. **Logs each step** immediately after completion:
   - Step number and name
   - Tool used
   - Full input and output
   - Execution time
   - Metadata (workflow name, progress)

3. **Saves final report** when workflow completes:
   ```
   ✅ Workflow complete! Full session saved to: .workflow-sessions/session-2025-10-18-02-15-30-workflow-creative-brainstorm-yaml.md
   ```

### 2. Session File Format

Each session creates a markdown file with:

```markdown
# Focus MCP workflow-creative-brainstorm-yaml Session

## Metadata
- **Session ID**: session-2025-10-18-02-15-30-workflow-creative-brainstorm-yaml
- **Date**: 2025-10-18T02:15:30.000Z
- **Mode**: workflow-creative-brainstorm-yaml
- **Models Used**: gemini_brainstorm (workflow), openai_brainstorm (workflow), ...
- **Total Duration**: 285.3s
- **Query**: "Analysis of personality/komaai-expressions.ts..."

---

## Step 1: Step 1/7

**Model**: gemini_brainstorm
**Provider**: workflow
**Duration**: 12.5s

### Prompt:
```
Generate creative ideas for: Analysis of personality/komaai-expressions.ts...
```

### Response:
[Full step output here...]

---

## Step 2: Step 2/7
...
```

### 3. Monitoring Live Progress

**Option 1: Tail the session file** (recommended)
```bash
# Get the session file path from console output, then:
tail -f .workflow-sessions/session-*.md
```

**Option 2: Watch the directory**
```bash
watch -n 2 'ls -lth .workflow-sessions | head -10'
```

**Option 3: Server console logs**
The server stderr shows verbose progress:
```
🚀 STARTING STEP 1/7: initial-ideas (gemini_brainstorm)
...
✅ STEP 1/7 COMPLETE: initial-ideas
[Step output displayed]

📍 Step 1: STEP 1/7
Model: gemini_brainstorm (workflow)
Duration: 12500ms
🤖 Response:
[Output preview...]
```

## Usage Examples

### Running a Workflow with Progress Tracking

```typescript
// Via MCP tool
mcp__tachibot-mcp__workflow({
  name: "creative-brainstorm-yaml",
  query: "Your topic here",
  truncateSteps: false,  // Get full output
  maxStepTokens: 5000    // Control detail level
})
```

While it runs, in another terminal:
```bash
# Monitor progress live
tail -f .workflow-sessions/session-*.md

# Or watch for updates
watch -n 1 'tail -20 .workflow-sessions/session-*.md'
```

### Session File Location

- **Directory**: `./.workflow-sessions/` (in project root)
- **Format**: `session-YYYY-MM-DD-HH-MM-SS-workflow-{name}.md`
- **Auto-save**: After every step completion

## Configuration

The SessionLogger is configured in `src/workflows/custom-workflows.ts`:

```typescript
this.sessionLogger = new SessionLogger({
  saveSession: true,      // Save to file
  verbose: true,          // Console output
  autoSave: true,         // Save after each step
  outputFormat: "markdown",
  sessionDir: "./.workflow-sessions",
});
```

### Customization Options

You can modify settings in the constructor:

- `saveSession: boolean` - Enable/disable file saving
- `verbose: boolean` - Show detailed console logs
- `autoSave: boolean` - Save after each step (vs. only at end)
- `outputFormat: "markdown" | "json" | "html"` - Output format
- `sessionDir: string` - Where to save sessions

## File Management

### Viewing Past Sessions

```bash
# List all sessions
ls -lt .workflow-sessions/

# Search by workflow name
ls .workflow-sessions/*creative-brainstorm*

# View a session
cat .workflow-sessions/session-2025-10-18-02-15-30-workflow-creative-brainstorm-yaml.md
```

### Cleaning Old Sessions

The SessionLogger includes a cleanup utility:

```typescript
// In code (if needed):
await sessionLogger.clearOldSessions(30); // Keep last 30 days
```

Or manually:
```bash
# Remove sessions older than 7 days
find .workflow-sessions -name "*.md" -mtime +7 -delete
```

## Benefits

1. **No More Black Box** - See exactly what's happening at each step
2. **Debugging** - Full logs for troubleshooting workflow issues
3. **Monitoring** - Watch progress in real-time with `tail -f`
4. **Persistence** - Complete session history for review
5. **Transparency** - See input/output of every step

## Architecture

### Code Changes Made

1. **`src/workflows/custom-workflows.ts`**:
   - Added `SessionLogger` import
   - Created `sessionLogger` instance in constructor
   - Added `startSession()` at workflow start
   - Added `logStep()` after each step completion
   - Added `endSession()` on completion/error

2. **Session Flow**:
   ```
   Workflow Start
       ↓
   sessionLogger.startSession() → Creates .md file
       ↓
   For each step:
       Execute step
       ↓
       sessionLogger.logStep() → Appends to .md file
       ↓
   All steps complete
       ↓
   sessionLogger.endSession() → Saves final summary
   ```

## Next Steps After Restart

1. **Restart Claude Code** - Pick up the new server with SessionLogger
2. **Run a test workflow**:
   ```
   workflow test-brainstorm-mini "test topic"
   ```
3. **Open a new terminal** and run:
   ```bash
   tail -f .workflow-sessions/session-*.md
   ```
4. **Watch the magic** - See steps appear in real-time!

## Advanced: Programmatic Access

The SessionLogger can be used programmatically:

```typescript
import { SessionLogger } from "./session/session-logger.js";

const logger = new SessionLogger({
  saveSession: true,
  verbose: true,
  sessionDir: "./my-sessions"
});

// Start session
const sessionId = await logger.startSession("my-mode", "my query");

// Log steps
await logger.logStep(
  "gpt-5",
  "openai",
  "brainstorm",
  "Generate ideas about...",
  "Here are 5 ideas...",
  { custom: "metadata" }
);

// End and save
await logger.endSession(true);
```

## Troubleshooting

### Session Directory Not Created

If `.workflow-sessions/` doesn't exist:
```bash
# Check permissions
ls -la . | grep workflow-sessions

# Create manually if needed
mkdir -p .workflow-sessions
chmod 755 .workflow-sessions
```

### No Output During Workflow

1. Check server logs: `tail -f /tmp/server-debug.log`
2. Verify rebuild: `npm run build`
3. Restart server: Kill old processes and reconnect MCP

### Verbose Mode Too Noisy

Set `verbose: false` in SessionLogger constructor to reduce console output while keeping file logging.

## Summary

**Before**: Workflows run for minutes with no feedback
**After**: Live progress files + verbose logs + persistent session history

**Key Command**:
```bash
tail -f .workflow-sessions/session-*.md  # Watch your workflow run!
```

---

**Implementation Status**: ✅ Complete
**Testing Status**: ⏳ Pending server restart
**Documentation**: ✅ This file

Run `npm run build` and restart Claude Code to enable this feature!
