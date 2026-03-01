# 🤖 .clawdbot - Agent Cluster Management System

Automated multi-agent orchestration for the nofx project using Claude Code + glm-5.

## 📁 Structure

```
.clawdbot/
├── active-tasks.json      # Task registry
├── config.json            # Configuration
├── scripts/
│   ├── run-agent.sh       # Run agent in current dir
│   ├── spawn-agent.sh     # Create worktree + agent
│   ├── check-agents.sh    # Monitor agents (cron)
│   ├── review-pr.sh       # AI PR review
│   └── cleanup.sh         # Clean completed tasks
├── logs/                  # Agent logs
└── templates/
    └── task-prompt.md     # Task template
```

## 🚀 Quick Start

### Spawn a New Agent

```bash
# Create a new task with isolated worktree
./scripts/spawn-agent.sh <task-id> "<description>" [base-branch]

# Example
./scripts/spawn-agent.sh fix-logging "Fix log rotation in trader module" main
```

This will:
1. Create a new branch `agent/<task-id>`
2. Create a git worktree in `../nofx-worktrees/<task-id>`
3. Start a tmux session `codex-<task-id>`
4. Launch Claude Code with glm-5 model
5. Register the task in `active-tasks.json`

### Run Agent in Current Directory

```bash
# Run without worktree isolation
./scripts/run-agent.sh <task-id> "<description>"
```

### Check Agent Status

```bash
# Show status of all agents
./scripts/check-agents.sh --status

# Run monitoring (for cron)
./scripts/check-agents.sh
```

### Review a PR

```bash
# AI-powered code review
./scripts/review-pr.sh <pr-number> [task-id]

# Example
./scripts/review-pr.sh 42 fix-logging
```

### Cleanup Completed Tasks

```bash
# Interactive cleanup
./scripts/cleanup.sh

# Clean all completed/failed tasks
./scripts/cleanup.sh --all

# Clean specific task
./scripts/cleanup.sh --task-id fix-logging

# Keep logs when cleaning
./scripts/cleanup.sh --all --keep-logs
```

## ⚙️ Configuration

Edit `config.json` to customize:

```json
{
  "projectPath": "/path/to/nofx",
  "defaultModel": "zai/glm-5",
  "maxRetries": 3,
  "sessionPrefix": "codex",
  "checkInterval": "10m",
  "notification": {
    "type": "terminal",
    "sound": true
  },
  "git": {
    "mainBranch": "main",
    "remote": "origin"
  }
}
```

## 🔄 Cron Setup

Add to crontab (`crontab -e`):

```bash
# Check agents every 10 minutes
*/10 * * * * /Users/boom/.openclaw/workspace/nofx/.clawdbot/scripts/check-agents.sh >> /Users/boom/.openclaw/workspace/nofx/.clawdbot/logs/cron.log 2>&1
```

## 📋 Definition of Done

A task is considered complete when:
- [ ] PR created
- [ ] Branch synced to main
- [ ] CI passing
- [ ] glm-5 review passed
- [ ] Screenshots attached (if UI changes)

## 🔧 Tmux Commands

```bash
# List all agent sessions
tmux list-sessions | grep codex

# Attach to specific agent
tmux attach -t codex-<task-id>

# Send command to agent
tmux send-keys -t codex-<task-id> "your command" Enter

# Kill agent session
tmux kill-session -t codex-<task-id>
```

## 📊 Task States

| State | Description |
|-------|-------------|
| `running` | Agent actively working |
| `completed` | Task finished successfully |
| `failed` | Task failed after max retries |

## 🔔 Notifications

Currently supports macOS terminal notifications. To enable:

```bash
# Install terminal-notifier (optional)
brew install terminal-notifier
```

Future: Telegram integration planned.

## 📝 Log Files

All logs are stored in `logs/`:

```
logs/
├── <task-id>.log          # Agent output
├── <task-id>-review.log   # PR review logs
├── check-agents.log       # Monitoring logs
└── cron.log               # Cron output
```

## 🛠️ Troubleshooting

### Agent Stuck

```bash
# Check session
tmux attach -t codex-<task-id>

# Restart agent
./scripts/cleanup.sh --task-id <task-id>
./scripts/spawn-agent.sh <task-id> "<description>"
```

### Worktree Issues

```bash
# List worktrees
git worktree list

# Manually remove worktree
git worktree remove <path> --force
```

### Branch Issues

```bash
# List agent branches
git branch | grep agent/

# Delete branch
git branch -D agent/<task-id>
```

## 📖 Examples

### Fix a Bug

```bash
./scripts/spawn-agent.sh bug-123 "Fix nil pointer in trader.go line 45"
```

### Add Feature

```bash
./scripts/spawn-agent.sh feat-webhooks "Add webhook support for trade events" develop
```

### Quick Fix (no worktree)

```bash
cd /path/to/nofx
../.clawdbot/scripts/run-agent.sh quick-readme "Update README with new API docs"
```

---

*Built for the nofx project with OpenClaw + Claude Code + glm-5*
