#!/usr/bin/env bash
#
# spawn-agent.sh - Create worktree + spawn Claude Code agent
#
# Usage: ./spawn-agent.sh <task-id> <task-description> [base-branch]
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAWDBOT_ROOT="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$CLAWDBOT_ROOT")"
CONFIG_FILE="$CLAWDBOT_ROOT/config.json"
TASKS_FILE="$CLAWDBOT_ROOT/active-tasks.json"
LOGS_DIR="$CLAWDBOT_ROOT/logs"

# Load config
MODEL=$(jq -r '.defaultModel' "$CONFIG_FILE")
SESSION_PREFIX=$(jq -r '.sessionPrefix' "$CONFIG_FILE")
MAIN_BRANCH=$(jq -r '.git.mainBranch' "$CONFIG_FILE")
REMOTE=$(jq -r '.git.remote' "$CONFIG_FILE")

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

usage() {
    echo "Usage: $0 <task-id> <task-description> [base-branch]"
    echo ""
    echo "Arguments:"
    echo "  task-id          Unique identifier for this task"
    echo "  task-description Description of the task (quoted)"
    echo "  base-branch      Base branch to create from (default: main)"
    echo ""
    echo "Example:"
    echo "  $0 fix-logging 'Fix log rotation in trader module' main"
    exit 1
}

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check dependencies
if ! command -v tmux &> /dev/null; then
    log_error "tmux is not installed. Install it with: brew install tmux"
    exit 1
fi

if ! command -v claude &> /dev/null; then
    log_error "claude CLI is not installed. Install Claude Code first."
    exit 1
fi

# Check arguments
if [[ $# -lt 2 ]]; then
    usage
fi

TASK_ID="$1"
TASK_DESCRIPTION="$2"
BASE_BRANCH="${3:-$MAIN_BRANCH}"
BRANCH_NAME="agent/${TASK_ID}"
WORKTREE_PATH="${PROJECT_ROOT}-worktrees/${TASK_ID}"
SESSION_NAME="${SESSION_PREFIX}-${TASK_ID}"
LOG_FILE="$LOGS_DIR/${TASK_ID}.log"

# Ensure logs directory exists
mkdir -p "$LOGS_DIR"
mkdir -p "$(dirname "$WORKTREE_PATH")"

log_info "Task ID: $TASK_ID"
log_info "Description: $TASK_DESCRIPTION"
log_info "Base branch: $BASE_BRANCH"
log_info "Branch name: $BRANCH_NAME"

# Check if task already exists
if jq -e ".tasks[] | select(.id == \"$TASK_ID\")" "$TASKS_FILE" > /dev/null 2>&1; then
    log_error "Task $TASK_ID already exists!"
    exit 1
fi

# Check if tmux session already exists
if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    log_error "Tmux session $SESSION_NAME already exists!"
    exit 1
fi

cd "$PROJECT_ROOT"

# Fetch latest
log_info "Fetching latest from $REMOTE..."
git fetch "$REMOTE" 2>&1 | tee -a "$LOG_FILE"

# Check if branch already exists
if git show-ref --verify --quiet "refs/heads/$BRANCH_NAME"; then
    log_warn "Branch $BRANCH_NAME already exists locally"
else
    # Create new branch
    log_info "Creating branch $BRANCH_NAME from $BASE_BRANCH..."
    git branch "$BRANCH_NAME" "remotes/$REMOTE/$BASE_BRANCH" 2>&1 | tee -a "$LOG_FILE" || {
        # Try local base branch
        git branch "$BRANCH_NAME" "$BASE_BRANCH" 2>&1 | tee -a "$LOG_FILE"
    }
fi

# Create worktree
log_info "Creating worktree at $WORKTREE_PATH..."
if [[ -d "$WORKTREE_PATH" ]]; then
    log_warn "Worktree path already exists, removing..."
    rm -rf "$WORKTREE_PATH"
fi

git worktree add "$WORKTREE_PATH" "$BRANCH_NAME" 2>&1 | tee -a "$LOG_FILE"

# Generate task prompt from template
TEMPLATE_FILE="$CLAWDBOT_ROOT/templates/task-prompt.md"
PROMPT_FILE="$WORKTREE_PATH/.task-prompt.md"

START_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

sed -e "s|{{TASK_NAME}}|$TASK_ID|g" \
    -e "s|{{BRANCH_NAME}}|$BRANCH_NAME|g" \
    -e "s|{{TASK_ID}}|$TASK_ID|g" \
    -e "s|{{TASK_DESCRIPTION}}|$TASK_DESCRIPTION|g" \
    -e "s|{{REQUIREMENTS}}|- Complete the task as described\n- Follow project conventions|g" \
    -e "s|{{NOTES}}||g" \
    -e "s|{{START_TIME}}|$START_TIME|g" \
    "$TEMPLATE_FILE" > "$PROMPT_FILE"

# Append actual task description
cat >> "$PROMPT_FILE" << EOF

## Your Task

$TASK_DESCRIPTION

Please work on this task following the project conventions. When done:
1. Commit your changes with a descriptive message
2. Push the branch to origin
3. Create a PR if appropriate
EOF

# Register task
log_info "Registering task in active-tasks.json..."
TASK_ENTRY=$(cat <<EOF
{
  "id": "$TASK_ID",
  "description": "$TASK_DESCRIPTION",
  "branch": "$BRANCH_NAME",
  "worktreePath": "$WORKTREE_PATH",
  "sessionName": "$SESSION_NAME",
  "model": "$MODEL",
  "baseBranch": "$BASE_BRANCH",
  "status": "running",
  "retries": 0,
  "maxRetries": 3,
  "startTime": "$START_TIME",
  "lastChecked": null,
  "prNumber": null,
  "ciStatus": null
}
EOF
)

# Update tasks file
jq ".tasks += [$TASK_ENTRY] | .lastUpdated = \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"" "$TASKS_FILE" > "${TASKS_FILE}.tmp"
mv "${TASKS_FILE}.tmp" "$TASKS_FILE"

# Create tmux session and start agent
log_info "Starting tmux session: $SESSION_NAME"
tmux new-session -d -s "$SESSION_NAME" -c "$WORKTREE_PATH"

# Send the claude command to tmux
log_info "Launching Claude Code agent..."
tmux send-keys -t "$SESSION_NAME" "cd $WORKTREE_PATH" Enter
tmux send-keys -t "$SESSION_NAME" "claude --model $MODEL --dangerously-skip-permissions -p \"$(cat "$PROMPT_FILE")\" 2>&1 | tee -a $LOG_FILE" Enter

log_success "Agent spawned successfully!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Task ID:        $TASK_ID"
echo "🌿 Branch:         $BRANCH_NAME"
echo "📁 Worktree:       $WORKTREE_PATH"
echo "🖥️  Tmux Session:  $SESSION_NAME"
echo "📄 Log File:       $LOG_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Commands:"
echo "  Attach to session:  tmux attach -t $SESSION_NAME"
echo "  View logs:          tail -f $LOG_FILE"
echo "  Check status:       $SCRIPT_DIR/check-agents.sh"
echo ""
