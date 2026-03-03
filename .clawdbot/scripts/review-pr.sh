#!/usr/bin/env bash
#
# review-pr.sh - AI-powered PR review using glm-5
#
# Usage: ./review-pr.sh <pr-number> [task-id]
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAWDBOT_ROOT="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$CLAWDBOT_ROOT")"
CONFIG_FILE="$CLAWDBOT_ROOT/config.json"
LOGS_DIR="$CLAWDBOT_ROOT/logs"

# Load config
MODEL=$(jq -r '.defaultModel' "$CONFIG_FILE")

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

usage() {
    echo "Usage: $0 <pr-number> [task-id]"
    echo ""
    echo "Perform an AI-powered code review on a PR using glm-5."
    echo ""
    echo "Arguments:"
    echo "  pr-number   The PR number to review"
    echo "  task-id     Optional task ID for logging"
    echo ""
    echo "Example:"
    echo "  $0 42 fix-logging"
    exit 1
}

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

if [[ $# -lt 1 ]]; then
    usage
fi

PR_NUMBER="$1"
TASK_ID="${2:-review-pr-$PR_NUMBER}"
LOG_FILE="$LOGS_DIR/${TASK_ID}-review.log"

mkdir -p "$LOGS_DIR"

log_info "Reviewing PR #$PR_NUMBER..."
log_info "Model: $MODEL"

cd "$PROJECT_ROOT"

# Get PR info
log_info "Fetching PR details..."
PR_INFO=$(gh pr view "$PR_NUMBER" --json title,body,author,baseRefName,headRefName,files,additions,deletions)

PR_TITLE=$(echo "$PR_INFO" | jq -r '.title')
PR_AUTHOR=$(echo "$PR_INFO" | jq -r '.author.login')
PR_BASE=$(echo "$PR_INFO" | jq -r '.baseRefName')
PR_HEAD=$(echo "$PR_INFO" | jq -r '.headRefName')
PR_FILES=$(echo "$PR_INFO" | jq -r '.files | length')
PR_ADDITIONS=$(echo "$PR_INFO" | jq -r '.additions')
PR_DELETIONS=$(echo "$PR_INFO" | jq -r '.deletions')

log_info "PR Title: $PR_TITLE"
log_info "Author: $PR_AUTHOR"
log_info "Base: $PR_BASE <- Head: $PR_HEAD"
log_info "Files changed: $PR_FILES (+$PR_ADDITIONS -$PR_DELETIONS)"

# Get diff
log_info "Fetching diff..."
DIFF=$(gh pr diff "$PR_NUMBER" 2>/dev/null || echo "")

if [[ -z "$DIFF" ]]; then
    log_error "Could not fetch diff for PR #$PR_NUMBER"
    exit 1
fi

# Check diff size (limit to avoid token limits)
DIFF_LINES=$(echo "$DIFF" | wc -l | tr -d ' ')
if [[ "$DIFF_LINES" -gt 2000 ]]; then
    log_warn "Diff is large ($DIFF_LINES lines), truncating for review..."
    DIFF=$(echo "$DIFF" | head -2000)
    DIFF="${DIFF}

... [truncated for review - diff too large]"
fi

# Build review prompt
REVIEW_PROMPT="You are a code reviewer for the nofx project (a Go-based trading system).

Please review the following pull request and provide:
1. A summary of the changes
2. Potential issues or bugs
3. Code quality suggestions
4. Security concerns (if any)
5. Test coverage recommendations
6. Overall assessment (APPROVE / REQUEST_CHANGES / COMMENT)

## PR Information
- Title: $PR_TITLE
- Author: $PR_AUTHOR
- Base Branch: $PR_BASE
- Head Branch: $PR_HEAD
- Files Changed: $PR_FILES
- Additions: $PR_ADDITIONS
- Deletions: $PR_DELETIONS

## Diff

\`\`\`diff
$DIFF
\`\`\`

## Review Format

Please format your review as:

### Summary
[Brief summary of changes]

### Issues Found
- [List any bugs or issues]

### Suggestions
- [Code quality improvements]

### Security
- [Any security concerns]

### Testing
- [Test coverage recommendations]

### Verdict
[APPROVE / REQUEST_CHANGES / COMMENT] - [Reason]

---

Provide a concise, actionable review. Focus on important issues, not nitpicks."

# Run review
log_info "Running AI review..."
REVIEW_FILE=$(mktemp)
echo "$REVIEW_PROMPT" > "$REVIEW_FILE"

REVIEW_RESULT=$(claude --model "$MODEL" --dangerously-skip-permissions -p "$(cat "$REVIEW_FILE")" 2>&1 | tee -a "$LOG_FILE")

rm -f "$REVIEW_FILE"

# Extract verdict
VERDICT=$(echo "$REVIEW_RESULT" | grep -i "### Verdict" -A 1 | tail -1 || echo "COMMENT")

log_info "Review verdict: $VERDICT"

# Post review as PR comment
log_info "Posting review as PR comment..."

COMMENT_BODY="## 🤖 AI Code Review (glm-5)

$REVIEW_RESULT

---
*Review generated automatically by .clawdbot*"

gh pr comment "$PR_NUMBER" --body "$COMMENT_BODY" 2>&1 | tee -a "$LOG_FILE"

log_success "Review posted to PR #$PR_NUMBER"

# If verdict is APPROVE, optionally auto-approve
if echo "$VERDICT" | grep -qi "APPROVE"; then
    log_success "Review verdict is APPROVE"
    read -p "Auto-approve PR? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        gh pr review "$PR_NUMBER" --approve --body "Auto-approved based on AI review."
        log_success "PR #$PR_NUMBER approved!"
    fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Review complete!"
echo "PR: https://github.com/$(gh repo view --json nameWithOwner -q .nameWithOwner)/pull/$PR_NUMBER"
echo "Log: $LOG_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
