#!/usr/bin/env bash
#
# check-agents.sh - Monitor all active agents
#
# Run via cron every 10 minutes:
# */10 * * * * /path/to/check-agents.sh >> /path/to/logs/cron.log 2>&1
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
MAX_RETRIES=$(jq -r '.maxRetries' "$CONFIG_FILE")
MAIN_BRANCH=$(jq -r '.git.mainBranch' "$CONFIG_FILE")
REMOTE=$(jq -r '.git.remote' "$CONFIG_FILE")
NOTIFICATION_TYPE=$(jq -r '.notification.type' "$CONFIG_FILE")
NOTIFICATION_SOUND=$(jq -r '.notification.sound' "$CONFIG_FILE")

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

LOG_FILE="$LOGS_DIR/check-agents.log"
mkdir -p "$LOGS_DIR"

log() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] $1" | tee -a "$LOG_FILE"
}

log_info() { log "${BLUE}[INFO]${NC} $1"; }
log_success() { log "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { log "${YELLOW}[WARN]${NC} $1"; }
log_error() { log "${RED}[ERROR]${NC} $1"; }

# Send notification
send_notification() {
    local title="$1"
    local message="$2"
    local sound_flag=""
    
    if [[ "$NOTIFICATION_SOUND" == "true" ]]; then
        sound_flag="-sound default"
    fi
    
    case "$NOTIFICATION_TYPE" in
        terminal)
            if command -v terminal-notifier &> /dev/null; then
                terminal-notifier -title "$title" -message "$message" $sound_flag
            else
                # Fallback to osascript
                osascript -e "display notification \"$message\" with title \"$title\"" 2>/dev/null || true
            fi
            ;;
        *)
            log "Notification: $title - $message"
            ;;
    esac
}

# Check if tmux session is alive
check_session() {
    local session_name="$1"
    tmux has-session -t "$session_name" 2>/dev/null
}

# Check PR status
check_pr_status() {
    local branch="$1"
    local pr_info
    
    pr_info=$(gh pr list --head "$branch" --json number,state,url,statusCheckRollup 2>/dev/null || echo "[]")
    
    if [[ "$pr_info" == "[]" ]] || [[ "$pr_info" == "" ]]; then
        echo '{"exists": false}'
        return
    fi
    
    echo "$pr_info" | jq '.[0] + {exists: true}'
}

# Check CI status from PR info
get_ci_status() {
    local pr_info="$1"
    
    if ! echo "$pr_info" | jq -e '.exists' > /dev/null 2>&1; then
        echo "no-pr"
        return
    fi
    
    local rollup=$(echo "$pr_info" | jq -r '.statusCheckRollup // []')
    local total=$(echo "$rollup" | jq 'length')
    local success=$(echo "$rollup" | jq '[.[] | select(.conclusion == "SUCCESS" or .conclusion == "NEUTRAL")] | length')
    
    if [[ "$total" -eq 0 ]]; then
        echo "pending"
    elif [[ "$total" -eq "$success" ]]; then
        echo "success"
    else
        echo "failed"
    fi
}

# Retry a failed task
retry_task() {
    local task_id="$1"
    local branch="$2"
    local worktree_path="$3"
    local session_name="$4"
    local retries="$5"
    local log_path="$LOGS_DIR/${task_id}.log"
    
    if [[ "$retries" -ge "$MAX_RETRIES" ]]; then
        log_error "Task $task_id exceeded max retries ($MAX_RETRIES)"
        send_notification "Agent Failed" "Task $task_id failed after $MAX_RETRIES retries"
        
        # Update task status
        jq "(.tasks[] | select(.id == \"$task_id\")) |= . + {\"status\": \"failed\", \"lastChecked\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"}" \
            "$TASKS_FILE" > "${TASKS_FILE}.tmp"
        mv "${TASKS_FILE}.tmp" "$TASKS_FILE"
        return 1
    fi
    
    log_warn "Retrying task $task_id (attempt $((retries + 1))/$MAX_RETRIES)..."
    
    # Kill existing session if any
    tmux kill-session -t "$session_name" 2>/dev/null || true
    
    # Create new session
    tmux new-session -d -s "$session_name" -c "$worktree_path"
    tmux send-keys -t "$session_name" "cd $worktree_path" Enter
    tmux send-keys -t "$session_name" "claude --model $MODEL --dangerously-skip-permissions -p 'Continue working on this task. Check the current state and proceed.' 2>&1 | tee -a $log_path" Enter
    
    # Update retry count
    jq "(.tasks[] | select(.id == \"$task_id\")) |= . + {\"retries\": $((retries + 1)), \"status\": \"running\", \"lastChecked\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"}" \
        "$TASKS_FILE" > "${TASKS_FILE}.tmp"
    mv "${TASKS_FILE}.tmp" "$TASKS_FILE"
    
    return 0
}

# Process completed task
complete_task() {
    local task_id="$1"
    local branch="$2"
    local pr_number="$3"
    
    log_success "Task $task_id completed successfully!"
    send_notification "Agent Completed" "Task $task_id finished (PR #$pr_number)"
    
    # Update task status
    jq "(.tasks[] | select(.id == \"$task_id\")) |= . + {\"status\": \"completed\", \"prNumber\": $pr_number, \"lastChecked\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"}" \
        "$TASKS_FILE" > "${TASKS_FILE}.tmp"
    mv "${TASKS_FILE}.tmp" "$TASKS_FILE"
}

# Main check loop
main() {
    log_info "Starting agent check..."
    
    # Check if tasks file exists and has tasks
    if [[ ! -f "$TASKS_FILE" ]]; then
        log_info "No tasks file found"
        exit 0
    fi
    
    local task_count=$(jq '.tasks | length' "$TASKS_FILE")
    
    if [[ "$task_count" -eq 0 ]]; then
        log_info "No active tasks"
        exit 0
    fi
    
    log_info "Checking $task_count active task(s)..."
    
    local completed_count=0
    local failed_count=0
    local running_count=0
    
    # Process each task
    jq -c '.tasks[]' "$TASKS_FILE" | while read -r task; do
        local task_id=$(echo "$task" | jq -r '.id')
        local branch=$(echo "$task" | jq -r '.branch')
        local worktree_path=$(echo "$task" | jq -r '.worktreePath')
        local session_name=$(echo "$task" | jq -r '.sessionName')
        local status=$(echo "$task" | jq -r '.status')
        local retries=$(echo "$task" | jq -r '.retries')
        
        log_info "Checking task: $task_id (status: $status)"
        
        # Skip already completed/failed tasks
        if [[ "$status" == "completed" ]]; then
            ((completed_count++)) || true
            continue
        fi
        
        if [[ "$status" == "failed" ]]; then
            ((failed_count++)) || true
            continue
        fi
        
        # Check tmux session
        if ! check_session "$session_name"; then
            log_warn "Session $session_name not found for task $task_id"
            
            # Check if there's a PR (task might have completed)
            local pr_info=$(check_pr_status "$branch")
            local pr_exists=$(echo "$pr_info" | jq -r '.exists')
            
            if [[ "$pr_exists" == "true" ]]; then
                local pr_number=$(echo "$pr_info" | jq -r '.number')
                local pr_state=$(echo "$pr_info" | jq -r '.state')
                local ci_status=$(get_ci_status "$pr_info")
                
                if [[ "$pr_state" == "MERGED" ]]; then
                    complete_task "$task_id" "$branch" "$pr_number"
                    ((completed_count++)) || true
                    continue
                fi
                
                if [[ "$ci_status" == "success" ]] && [[ "$pr_state" == "OPEN" ]]; then
                    # PR is ready for review
                    log_success "Task $task_id has passing CI, ready for review"
                    send_notification "PR Ready" "Task $task_id: PR #$pr_number is ready for review"
                fi
            else
                # No session and no PR - might need retry
                retry_task "$task_id" "$branch" "$worktree_path" "$session_name" "$retries"
            fi
            continue
        fi
        
        # Session exists - check progress
        ((running_count++)) || true
        
        # Check if there's a PR
        local pr_info=$(check_pr_status "$branch")
        local pr_exists=$(echo "$pr_info" | jq -r '.exists')
        
        if [[ "$pr_exists" == "true" ]]; then
            local pr_number=$(echo "$pr_info" | jq -r '.number')
            local ci_status=$(get_ci_status "$pr_info")
            
            # Update CI status in tasks file
            jq "(.tasks[] | select(.id == \"$task_id\")) |= . + {\"ciStatus\": \"$ci_status\", \"prNumber\": $pr_number, \"lastChecked\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"}" \
                "$TASKS_FILE" > "${TASKS_FILE}.tmp"
            mv "${TASKS_FILE}.tmp" "$TASKS_FILE"
            
            log_info "Task $task_id: PR #$pr_number exists, CI: $ci_status"
        fi
        
        # Update last checked time
        jq "(.tasks[] | select(.id == \"$task_id\")) |= . + {\"lastChecked\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"}" \
            "$TASKS_FILE" > "${TASKS_FILE}.tmp"
        mv "${TASKS_FILE}.tmp" "$TASKS_FILE"
    done
    
    log_info "Check complete - Running: $running_count, Completed: $completed_count, Failed: $failed_count"
}

# Status display function
show_status() {
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  Agent Cluster Status${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    if [[ ! -f "$TASKS_FILE" ]]; then
        echo "No tasks file found."
        return
    fi
    
    local task_count=$(jq '.tasks | length' "$TASKS_FILE")
    
    if [[ "$task_count" -eq 0 ]]; then
        echo "No active tasks."
        return
    fi
    
    echo -e "${BLUE}Active Tasks ($task_count):${NC}"
    echo ""
    
    jq -c '.tasks[]' "$TASKS_FILE" | while read -r task; do
        local id=$(echo "$task" | jq -r '.id')
        local desc=$(echo "$task" | jq -r '.description')
        local status=$(echo "$task" | jq -r '.status')
        local branch=$(echo "$task" | jq -r '.branch')
        local session=$(echo "$task" | jq -r '.sessionName')
        local pr=$(echo "$task" | jq -r '.prNumber // "none"')
        local ci=$(echo "$task" | jq -r '.ciStatus // "unknown"')
        local retries=$(echo "$task" | jq -r '.retries')
        local start=$(echo "$task" | jq -r '.startTime')
        
        # Status color
        local status_color
        case "$status" in
            running) status_color=$GREEN ;;
            completed) status_color=$CYAN ;;
            failed) status_color=$RED ;;
            *) status_color=$YELLOW ;;
        esac
        
        echo -e "  ${status_color}●${NC} $id"
        echo -e "    Description: ${desc:0:50}$([ ${#desc} -gt 50 ] && echo '...')"
        echo -e "    Status:      ${status_color}$status${NC}"
        echo -e "    Branch:      $branch"
        echo -e "    Session:     $session"
        echo -e "    PR:          $pr | CI: $ci"
        echo -e "    Retries:     $retries"
        echo -e "    Started:     $start"
        echo ""
    done
}

# Run
if [[ "${1:-}" == "--status" ]] || [[ "${1:-}" == "-s" ]]; then
    show_status
else
    main
fi
