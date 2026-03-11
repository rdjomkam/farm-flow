#!/usr/bin/env bash
# start-team.sh — Launch Farm Flow agent team using Claude Code built-in teams
#
# Architecture:
#   1 leader session (project-manager) spawns teammates via TeamCreate + Task tool.
#   Each teammate gets its own tmux pane automatically (teammateMode: "tmux").
#   Communication uses built-in SendMessage mailboxes, not files.
#   Task tracking uses built-in TaskCreate/TaskUpdate/TaskList (shared).
#
# Usage:
#   ./start-team.sh              # Start leader — spawns teammates automatically
#   ./start-team.sh --shell      # Create tmux session only (no claude)
#   ./start-team.sh --dry-run    # Preview without executing
#   ./start-team.sh --kill       # Kill existing session

set -euo pipefail

# ── Configuration ────────────────────────────────────────────────────
SESSION="farm-flow-team"
PROJECT="/Users/ronald/project/dkfarm/farm-flow"
DRY_RUN=false
SHELL_ONLY=false
KILL_ONLY=false

LEADER_PROMPT='Tu es le chef de projet Farm Flow. Lis docs/TASKS.md pour identifier le sprint en cours. Utilise TeamCreate pour creer l equipe "farm-flow", puis spawne les agents necessaires (architect, db-specialist, developer, tester) via le Task tool avec team_name="farm-flow". Cree les taches du sprint avec TaskCreate, assigne-les aux agents, et coordonne le travail. Utilise SendMessage pour communiquer (pas broadcast). Le code-reviewer sera spawne en fin de sprint pour la review.'

# ── Parse arguments ──────────────────────────────────────────────────
for arg in "$@"; do
  case $arg in
    --dry-run)  DRY_RUN=true ;;
    --shell)    SHELL_ONLY=true ;;
    --kill)     KILL_ONLY=true ;;
    -h|--help)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --shell      Create tmux session without starting claude"
      echo "  --dry-run    Show what would be done"
      echo "  --kill       Kill existing farm-flow-team session"
      echo "  -h, --help   Show this help"
      echo ""
      echo "Architecture:"
      echo "  The leader (project-manager) starts in a single tmux window."
      echo "  It uses TeamCreate to spawn teammates, each in its own tmux pane."
      echo "  Communication: SendMessage (built-in mailbox)"
      echo "  Task tracking: TaskCreate/TaskUpdate/TaskList (shared)"
      echo ""
      echo "Tmux navigation:"
      echo "  Ctrl+B o         Next pane"
      echo "  Ctrl+B ;         Previous pane"
      echo "  Ctrl+B z         Zoom/unzoom pane"
      echo "  Ctrl+B q         Show pane numbers"
      echo "  Ctrl+B d         Detach (agents keep running)"
      echo "  Ctrl+B [         Scroll mode (q to exit)"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg (use --help)"
      exit 1
      ;;
  esac
done

# ── Kill mode ────────────────────────────────────────────────────────
if $KILL_ONLY; then
  if tmux has-session -t "$SESSION" 2>/dev/null; then
    tmux kill-session -t "$SESSION"
    echo "Session '$SESSION' killed."
  else
    echo "No session '$SESSION' found."
  fi
  exit 0
fi

# ── Prerequisites ────────────────────────────────────────────────────
for cmd in tmux claude; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "Error: '$cmd' is not installed or not in PATH."
    exit 1
  fi
done

if [ ! -d "$PROJECT" ]; then
  echo "Error: Project directory not found: $PROJECT"
  exit 1
fi

# ── Dry run ──────────────────────────────────────────────────────────
if $DRY_RUN; then
  echo "=== Dry Run ==="
  echo "Session:  $SESSION"
  echo "Project:  $PROJECT"
  echo "Window:   220x55"
  echo "Mode:     $(if $SHELL_ONLY; then echo 'shell only'; else echo 'leader auto-start'; fi)"
  echo ""
  echo "Flow:"
  echo "  1. Create tmux session with labeled leader pane"
  echo "  2. Launch project-manager (reads docs/TASKS.md)"
  echo "  3. project-manager calls TeamCreate to create team 'farm-flow'"
  echo "  4. project-manager spawns teammates via Task tool:"
  echo "     - architect        Architecture, interfaces TypeScript, decisions"
  echo "     - db-specialist    Schema Prisma, migrations, requetes DB"
  echo "     - developer        API routes, pages UI, composants React"
  echo "     - tester           Tests unitaires et integration (Vitest)"
  echo "  5. Each teammate auto-appears as a labeled tmux pane"
  echo "  6. code-reviewer spawned later for end-of-sprint review"
  echo ""
  echo "Pane borders: enabled (shows agent names)"
  exit 0
fi

# ── Check for existing session ───────────────────────────────────────
if tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "Session '$SESSION' already exists."
  echo "  Attach:  tmux attach -t $SESSION"
  echo "  Kill:    $0 --kill"
  exit 1
fi

# ── Create tmux session with single leader window ────────────────────
echo "Creating tmux session: $SESSION"
echo ""

tmux new-session -d -s "$SESSION" -n "leader" -c "$PROJECT" -x 220 -y 55

# Enable pane border titles so each agent pane shows its name
tmux set -t "$SESSION" pane-border-status top
tmux set -t "$SESSION" pane-border-format "#{pane_title}"
tmux select-pane -t "$SESSION:leader" -T "project-manager"

if $SHELL_ONLY; then
  tmux send-keys -t "$SESSION:leader" "# Farm Flow Leader — project-manager" Enter
  tmux send-keys -t "$SESSION:leader" "# Start with:  claude --agent project-manager \"$LEADER_PROMPT\"" Enter
else
  tmux send-keys -t "$SESSION:leader" "echo 'Waiting for project-manager to initialize...'" Enter
  sleep 1
  tmux send-keys -t "$SESSION:leader" "env -u CLAUDECODE claude --agent project-manager \"${LEADER_PROMPT}\"" Enter
fi

echo "Farm Flow team starting!"
echo ""
echo "Architecture:"
echo "  Window 'leader': project-manager (team leader)"
echo "  → Spawns teammates via TeamCreate (each gets a labeled tmux pane)"
echo ""
echo "Teammates (spawned automatically by project-manager):"
echo "  architect        Architecture, interfaces TypeScript, decisions"
echo "  db-specialist    Schema Prisma, migrations, requetes DB"
echo "  developer        API routes, pages UI, composants React"
echo "  tester           Tests unitaires et integration (Vitest)"
echo ""
echo "Navigation:"
echo "  Ctrl+B o         Next pane"
echo "  Ctrl+B ;         Previous pane"
echo "  Ctrl+B z         Zoom/unzoom pane"
echo "  Ctrl+B q         Show pane numbers"
echo "  Ctrl+B d         Detach (agents keep running)"
echo "  Ctrl+B [         Scroll mode (q to exit)"
echo ""
echo "To spawn code-reviewer for end-of-sprint review:"
echo "  In the project-manager pane, ask it to spawn code-reviewer"
echo ""

# Attach to session
tmux attach-session -t "$SESSION"
