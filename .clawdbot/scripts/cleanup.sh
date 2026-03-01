#!/usr/bin/env bash
#
# cleanup.sh - Clean up completed/failed agent worktrees and sessions
#
# Usage: ./cleanup.sh [--all] [--task-id <id>] [--keep-logs]
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAWDBOT_ROOT="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$CLAWDBOT_ROOT")"
CONFIG_FILE="$CLAWDBOT_ROOT/config.json"
TASKS_FILE="$CLAWDBOT_ROOT/active-tasks.json"
LOGS_DIR="$CLAWDBOT_ROOT/logs"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

CLEAN_ALL=false
CLEAN_TASK_ID=""
KEEP_LOGS=false

usage() {
    echo "Usage: $0 [options]"
    echo ""
    echo "Clean up completed/failed agent worktrees and sessions."
    echo ""
    echo "Options:"
    echo "  --all              Clean all completed and failed tasks"
    echo "  --task-id <id>     Clean specific task"
    echo "  --keep-logs        Keep log files when cleaning"
    echo "  -h, --help         Show this help"
    echo ""
    echo "Examples:"
    echo "  $0 --all                    # Clean all completed/failed tasks"
    echo "  $0 --task-id fix-logging    # Clean specific task"
    echo "  $0 --all --keep-logs        # Clean but keep log files"
    exit 0
}

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --all)
            CLEAN_ALL=true
            shift
            ;;
        --task-id)
            CLEAN_TASK_ID="$2"
            shift 2
            ;;
        --keep-logs)
            KEEP_LOGS=true
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            log_error "Unknown option: $1"
            usage
            ;;
    esac
done

# Cleanup function
cleanup_task() {
    local task_id="$1"
    local task_json="$2"
    
    local branch=$(echo "$task_json" | jq -r '.branch')
    local worktree_path=$(echo "$task_json" | jq -r '.worktreePath')
    local session_name=$(echo "$task_json" | jq -r '.sessionName')
    local status=$(echo "$task_json" | jq -r '.status')
    
    log_info "Cleaning up task: $task_id (status: $status)"
    
    # Kill tmux session if exists
    if tmux has-session -t "$session_name" 2>/dev/null; then
        log_info "Killing tmux session: $session_name"
        tmux kill-session -t "$session_name" || true
    fi
    
    # Remove worktree
    if [[ -d "$worktree_path" ]]; then
        log_info "Removing worktree: $worktree_path"
        cd "$PROJECT_ROOT"
        git worktree remove "$worktree_path" --force 2>/dev/null || rm -rf "$worktree_path"
    fi
    
    # Delete branch if completed
    if [[ "$status" == "completed" ]] || [[ "$status" == "failed" ]]; then
        log_info "Deleting branch: $branch"
        git branch -D "$branch" 2>/dev/null || true
        git push origin --delete "$branch" 2>/dev/null || true
    fi
    
    # Remove logs unless keeping
    if [[ "$KEEP_LOGS" != "true" ]]; then
        local log_file="$LOGS_DIR/${task_id}.log"
        if [[ -f "$log_file" ]]; then
            rm -f "$log_file"
            log_info "Removed log file: $log_file"
        fi
    fi
    
    # Remove from active-tasks.json
    log_info "Removing task from registry"
    jq "del(.tasks[] | select(.id == \"$task_id\"))" "$TASKS_FILE" > "${TASKS_FILE}.tmp"
    mv "${TASKS_FILE}.tmp" "$TASKS_FILE"
    
    log_success "Cleaned up task: $task_id"
}

cd "$PROJECT_ROOT"

# Check tasks file
if [[ ! -f "$TASKS_FILE" ]]; then
    log_info "No tasks file found"
    exit 0
fi

# Get tasks to clean
TASKS_TO_CLEAN=""

if [[ -n "$CLEAN_TASK_ID" ]]; then
    # Clean specific task
    TASKS_TO_CLEAN=$(jq -c ".tasks[] | select(.id == \"$CLEAN_TASK_ID\")" "$TASKS_FILE")
    if [[ -z "$TASKS_TO_CLEAN" ]]; then
        log_error "Task not found: $CLEAN_TASK_ID"
        exit 1
    fi
elif [[ "$CLEAN_ALL" == "true" ]]; then
    # Clean all completed/failed tasks
    TASKS_TO_CLEAN=$(jq -c '.tasks[] | select(.status == "completed" or .status == "failed")' "$TASKS_FILE")
else
    # Interactive mode - show tasks and ask
    echo -e "${CYAN}Available tasks to clean:${NC}"
    echo ""
    
    jq -r '.tasks[] | "\(.id) [\(.status)] - \(.description | .[0:40])"' "$TASKS_FILE" | head -20
    echo ""
    
    read -p "Enter task ID to clean (or 'all' for completed/failed): " choice
    
    if [[ "$choice" == "all" ]]; then
        TASKS_TO_CLEAN=$(jq -c '.tasks[] | select(.status == "completed" or .status == "failed")' "$TASKS_FILE")
    else
        TASKS_TO_CLEAN=$(jq -c ".tasks[] | select(.id == \"$choice\")" "$TASKS_FILE")
    fi
fi

if [[ -z "$TASKS_TO_CLEAN" ]]; then
    log_info "No tasks to clean"
    exit 0
fi

# Process each task
CLEANED_COUNT=0
while IFS= read -r task; do
    task_id=$(echo "$task" | jq -r '.id')
    cleanup_task "$task_id" "$task"
    ((CLEANED_COUNT++)) || true
done <<< "$TASKS_TO_CLEAN"

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Cleanup complete! Cleaned $CLEANED_COUNT task(s)${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
