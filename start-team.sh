#!/bin/bash
# start-team.sh — Lance les 6 agents Claude Code dans tmux

SESSION="silures"
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Tuer la session si elle existe déjà
tmux kill-session -t $SESSION 2>/dev/null

# Créer la session avec la première fenêtre (Project Manager)
tmux new-session -d -s $SESSION -n "pm" -c "$PROJECT_DIR"

# Créer une fenêtre par agent
tmux new-window -t $SESSION -n "architect" -c "$PROJECT_DIR"
tmux new-window -t $SESSION -n "db" -c "$PROJECT_DIR"
tmux new-window -t $SESSION -n "dev" -c "$PROJECT_DIR"
tmux new-window -t $SESSION -n "tester" -c "$PROJECT_DIR"
tmux new-window -t $SESSION -n "reviewer" -c "$PROJECT_DIR"

# Lancer Claude Code dans chaque fenêtre
tmux send-keys -t $SESSION:pm       "claude --append-system-prompt-file .claude/agents/project-manager.md" Enter
tmux send-keys -t $SESSION:architect "claude --append-system-prompt-file .claude/agents/architect.md" Enter
tmux send-keys -t $SESSION:db       "claude --append-system-prompt-file .claude/agents/db-specialist.md" Enter
tmux send-keys -t $SESSION:dev      "claude --append-system-prompt-file .claude/agents/developer.md" Enter
tmux send-keys -t $SESSION:tester   "claude --append-system-prompt-file .claude/agents/tester.md" Enter
tmux send-keys -t $SESSION:reviewer "claude --append-system-prompt-file .claude/agents/code-reviewer.md" Enter

# Revenir à la fenêtre du Project Manager
tmux select-window -t $SESSION:pm

# Se connecter à la session
tmux attach -t $SESSION
