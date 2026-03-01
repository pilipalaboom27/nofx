#!/usr/bin/env bash
#
# run-agent.sh - Run a single agent in current directory (no worktree)
#
# Usage: ./run-agent.sh <task-id> <task-description>
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAWDBOT_ROOT="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$CLAWDBOT_ROOT")"
CONFIG_FILE="$CLAWDBOT_ROOT/config.json"
LOGS_DIR="$CLAWDBOT_ROOT/logs"

# Load config
MODEL=$(jq -r '.defaultModel' "$CONFIG_FILE")
SESSION_PREFIX=$(jq -r '.sessionPrefix' "$CONFIG_FILE")

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

usage() {
    echo "Usage: $0 <task-id> <task-description>"
    echo ""
    echo "Run an agent in the current directory without creating a worktree."
    echo ""
    echo "Arguments:"
    echo "  task-id          Unique identifier for this task"
    echo "  task-description Description of the task (quoted)"
    echo ""
    echo "Example:"
    echo "  $0 quick-fix 'Fix typo in README'"
    exit 1
}

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

if [[ $# -lt 2 ]]; then
    usage
fi

TASK_ID="$1"
TASK_DESCRIPTION="$2"
SESSION_NAME="${SESSION_PREFIX}-${TASK_ID}"
LOG_FILE="$LOGS_DIR/${TASK_ID}.log"

mkdir -p "$LOGS_DIR"

log_info "Task ID: $TASK_ID"
log_info "Description: $TASK_DESCRIPTION"

# Check if tmux session already exists
if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    log_error "Tmux session $SESSION_NAME already exists!"
    exit 1
fi

# Create tmux session
log_info "Starting tmux session: $SESSION_NAME"
tmux new-session -d -s "$SESSION_NAME"

# Build prompt
PROMPT="Task: $TASK_DESCRIPTION

Please complete this task. Work in the current directory: $(pwd)

When done, summarize what you accomplished."

# Launch agent
log_info "Launching Claude Code agent..."
tmux send-keys -t "$SESSION_NAME" "cd $(pwd)" Enter
tmux send-keys -t "$SESSION_NAME" "claude --model $MODEL --dangerously-skip-permissions -p \"$PROMPT\" 2>&1 | tee -a $LOG_FILE" Enter

log_success "Agent started successfully!"
echo ""
echo "Commands:"
echo "  Attach:  tmux attach -t $SESSION_NAME"
echo "  Logs:    tail -f $LOG_FILE"
echo ""
