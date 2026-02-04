#!/bin/bash

# Ralph Wiggum - Autonomous Agent Loop
# Usage: .ralph/ralph.sh <task-folder> [iterations] [--dry-run] [--verbose] [--stream] [--min-clean=N]
#
# Example:
#   .ralph/ralph.sh .ralph/tasks/bug-audit 40 --stream --min-clean=2
#
# Options:
#   --min-clean=N  Require N consecutive clean passes before completion (default: 2)
#   --verbose      Show full output (default: truncate to 50 lines)
#   --stream       Show live output as it runs
#   --dry-run      Show prompt without running

set -e

# First argument is task folder (required)
TASK_DIR="${1:-.}"
shift 2>/dev/null || true

# Second argument is iterations (default 40) — only if it's a number
if [[ "${1:-}" =~ ^[0-9]+$ ]]; then
  ITERATIONS="$1"
  shift 2>/dev/null || true
else
  ITERATIONS=40
fi

DRY_RUN=false
VERBOSE=false
STREAM=false
MIN_CLEAN_PASSES=2

# Track consecutive clean passes
CONSECUTIVE_CLEAN=0

# Parse flags
for arg in "$@"; do
  case $arg in
    --dry-run)
      DRY_RUN=true
      ;;
    --verbose)
      VERBOSE=true
      ;;
    --stream)
      STREAM=true
      ;;
    --min-clean=*)
      MIN_CLEAN_PASSES="${arg#*=}"
      ;;
  esac
done

# Resolve task directory
if [ ! -d "$TASK_DIR" ]; then
  echo "Error: Task directory '$TASK_DIR' not found."
  echo "Usage: .ralph/ralph.sh <task-folder> [iterations] [--dry-run] [--verbose] [--stream]"
  exit 1
fi

# Set file paths relative to task directory
# Find *_PROMPT.md file (supports AUDIT_PROMPT.md, FIX_PROMPT.md, etc.)
PROMPT_FILE=$(find "$TASK_DIR" -maxdepth 1 -name '*_PROMPT.md' -type f | head -1)
if [ -z "$PROMPT_FILE" ]; then
  echo -e "${RED}Error: No *_PROMPT.md file found in '$TASK_DIR'${NC}"
  exit 1
fi
PLAN_FILE="$TASK_DIR/plan.md"
ACTIVITY_FILE="$TASK_DIR/activity.md"
LOG_FILE="$TASK_DIR/ralph.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
  local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
  echo -e "$msg"
  echo "$msg" >> "$LOG_FILE"
}

log_verbose() {
  if [ "$VERBOSE" = true ]; then
    log "$1"
  fi
}

# Check if claude CLI is available
if ! command -v claude &> /dev/null; then
  echo -e "${RED}Error: claude CLI not found. Install with: npm install -g @anthropic-ai/claude-code${NC}"
  exit 1
fi

# Check required files exist
for file in "$PROMPT_FILE" "$PLAN_FILE" "$ACTIVITY_FILE"; do
  if [ ! -f "$file" ]; then
    echo -e "${RED}Error: Required file '$file' not found.${NC}"
    echo ""
    echo "Task folder must contain:"
    echo "  - *_PROMPT.md      (instructions for each iteration)"
    echo "  - plan.md          (task list with passes: true/false)"
    echo "  - activity.md      (session log)"
    exit 1
  fi
done

TASK_NAME=$(basename "$TASK_DIR")
echo -e "${GREEN}Starting Ralph Wiggum - $TASK_NAME${NC}"
echo -e "${BLUE}Task folder: $TASK_DIR${NC}"
echo -e "${BLUE}Prompt file: $(basename "$PROMPT_FILE")${NC}"
log "Max iterations: $ITERATIONS"
log "Min clean passes: $MIN_CLEAN_PASSES"
log "Dry run: $DRY_RUN"
log "Stream mode: $STREAM"
log "Log file: $LOG_FILE"
echo ""

if [ "$DRY_RUN" = true ]; then
  echo -e "${YELLOW}DRY RUN MODE - Will show prompt but not execute${NC}"
  echo ""
  echo "=== $(basename "$PROMPT_FILE") contents ==="
  cat "$PROMPT_FILE"
  echo ""
  echo "=== End of prompt ==="
  echo ""
  log "Would run: claude -p \"\$(cat $PROMPT_FILE)\" --output-format text --max-turns 30"
  exit 0
fi

for ((i=1; i<=ITERATIONS; i++)); do
  log "${GREEN}=== Iteration $i of $ITERATIONS ===${NC}"

  # Show current task status before running
  log_verbose "Current plan.md passes status:"
  if [ "$VERBOSE" = true ]; then
    grep -o '"passes": [a-z]*' "$PLAN_FILE" || true
  fi

  # Run claude
  log "Running claude..."
  START_TIME=$(date +%s)

  if [ "$STREAM" = true ]; then
    # Stream mode - show live output, tee to log file
    result=$(claude -p "$(cat "$PROMPT_FILE")" --output-format text --max-turns 30 2>&1 | tee -a "$LOG_FILE") || true
  else
    # Quiet mode - capture output
    result=$(claude -p "$(cat "$PROMPT_FILE")" --output-format text --max-turns 30 2>&1) || true
    # Save result to log
    echo "$result" >> "$LOG_FILE"
  fi

  END_TIME=$(date +%s)
  DURATION=$((END_TIME - START_TIME))

  log "Iteration completed in ${DURATION}s"

  # Show result (only in non-stream mode)
  if [ "$STREAM" = false ]; then
    if [ "$VERBOSE" = true ]; then
      echo "$result"
    else
      # Truncate to first 50 lines by default
      echo "$result" | head -50
      LINES=$(echo "$result" | wc -l)
      if [ "$LINES" -gt 50 ]; then
        echo "... (truncated, $LINES total lines - see $LOG_FILE for full output)"
      fi
    fi
  fi

  # Check for completion signal
  if [[ "$result" == *"<promise>COMPLETE</promise>"* ]]; then
    CONSECUTIVE_CLEAN=$((CONSECUTIVE_CLEAN + 1))
    log "${YELLOW}Clean pass detected ($CONSECUTIVE_CLEAN of $MIN_CLEAN_PASSES required)${NC}"

    if [ "$CONSECUTIVE_CLEAN" -ge "$MIN_CLEAN_PASSES" ]; then
      log "${GREEN}Verified clean after $CONSECUTIVE_CLEAN consecutive passes! Total iterations: $i${NC}"
      exit 0
    else
      log "${BLUE}Continuing - need $((MIN_CLEAN_PASSES - CONSECUTIVE_CLEAN)) more clean passes${NC}"

      # Add a new verification task to plan.md
      LAST_PASS=$(grep -oE 'Pass [0-9]+' "$PLAN_FILE" | grep -oE '[0-9]+' | sort -n | tail -1 2>/dev/null || echo "0")
      NEXT_PASS=$((LAST_PASS + 1))

      log "${BLUE}Adding Pass $NEXT_PASS verification task${NC}"

      sed -i '' 's/^]$/,\
  {\
    "category": "audit-pass",\
    "description": "Pass '"$NEXT_PASS"': Verification pass '"$CONSECUTIVE_CLEAN"' of '"$MIN_CLEAN_PASSES"'",\
    "passes": false\
  }\
]/' "$PLAN_FILE"
    fi
  else
    # Reset counter if issues were found
    if [ "$CONSECUTIVE_CLEAN" -gt 0 ]; then
      log "${RED}Issues found - resetting clean counter${NC}"
    fi
    CONSECUTIVE_CLEAN=0
  fi

  # Check for errors
  if [[ "$result" == *"Error"* ]] || [[ "$result" == *"error"* ]]; then
    log "${YELLOW}Possible error detected in output${NC}"
  fi

  echo ""
  log "--- End of iteration $i ---"
  echo ""

  # Brief pause between iterations
  sleep 2
done

log "${YELLOW}Reached max iterations ($ITERATIONS) without completion${NC}"
log "Check $ACTIVITY_FILE and $PLAN_FILE for progress"
exit 1
