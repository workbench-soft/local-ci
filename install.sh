#!/usr/bin/env bash
# Sets up a Mac with everything README.md lists. Running it again is safe,
# since each step looks for its piece first. install.ps1 is the Windows version.
set -euo pipefail

dev_dir="$HOME/Documents/Dev"
script_dir=$(cd "$(dirname "$0")" && pwd)

step() { printf '\n==> %s\n' "$*"; }

# Appends a line to a file unless the file already holds it.
append_once() {
	grep -qxF "$2" "$1" || printf '%s\n' "$2" >>"$1"
}

# Asks for a global git setting that is still empty.
ask_git_setting() {
	if [ -z "$(git config --global "$1" || true)" ]; then
		read -rp "git $1: " value
		git config --global "$1" "$value"
	fi
}

copy_if_missing() {
	if [ ! -f "$2" ]; then
		step "$3"
		mkdir -p "$(dirname "$2")"
		cp "$1" "$2"
	fi
}

# --- Homebrew ---------------------------------------------------------------
if ! command -v brew >/dev/null 2>&1; then
	step "Installing Homebrew"
	/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi
eval "$(/opt/homebrew/bin/brew shellenv)"

step "Installing brew formulae"
brew install git gh mise fzf jq shellcheck shfmt terminal-notifier mkcert agent-browser

step "Installing brew casks"
brew install --cask visual-studio-code docker-desktop maccy claude android-platform-tools

# --- Oh My Zsh ---------------------------------------------------------------
if [ ! -d "$HOME/.oh-my-zsh" ]; then
	step "Installing Oh My Zsh"
	RUNZSH=no KEEP_ZSHRC=yes sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
fi

# --- .zshrc lines ------------------------------------------------------------
zshrc="$HOME/.zshrc"
touch "$zshrc"
step "Updating .zshrc"
# shellcheck disable=SC2016  # .zshrc gets these lines as written, unexpanded
append_once "$zshrc" 'export PATH="$HOME/.local/bin:$PATH"'
# shellcheck disable=SC2016
append_once "$zshrc" 'eval "$(mise activate zsh)"'

# --- Node toolchain ----------------------------------------------------------
step "Installing node, pnpm and yarn through mise"
mise use -g node@22 pnpm@latest yarn@1

step "Installing the Copilot CLI"
mise exec -- npm install -g @github/copilot

# --- Git config --------------------------------------------------------------
step "Setting git config"
git config --global color.ui true
git config --global push.autosetupremote true
ask_git_setting user.name
ask_git_setting user.email

# --- GitHub CLI --------------------------------------------------------------
# The repos below are private in workbench-soft, so the login goes first.
if ! gh auth status >/dev/null 2>&1; then
	step "Logging into GitHub"
	gh auth login
fi

# --- My repos ----------------------------------------------------------------
mkdir -p "$dev_dir"
for repo in git-aliases agent-skills gh-review-notify; do
	repo_dir="$dev_dir/$repo"
	if [ ! -d "$repo_dir" ]; then
		step "Cloning $repo"
		gh repo clone "workbench-soft/$repo" "$repo_dir"
	fi
	step "Running $repo/install.sh"
	"$repo_dir/install.sh"
done

# --- gh extensions -----------------------------------------------------------
if ! gh extension list 2>/dev/null | grep -q gh-stack; then
	step "Installing gh-stack"
	gh extension install github/gh-stack
fi

# --- Teamwork Graph CLI ------------------------------------------------------
# The installer asks you to accept Atlassian's terms and log in. It then adds
# the upkeep LaunchAgent that keeps twg up to date.
if [ ! -x "$HOME/.local/bin/twg" ]; then
	step "Installing twg"
	bash <(curl -fsSL https://teamwork-graph.atlassian.com/cli/install)
fi

# --- VS Code extensions ------------------------------------------------------
step "Installing VS Code extensions"
for extension in \
	anthropic.claude-code \
	dbaeumer.vscode-eslint \
	esbenp.prettier-vscode \
	formulahendry.auto-rename-tag \
	huizhou.githd \
	nrwl.angular-console \
	oleg-chibikov.open-in-remote-repo \
	orta.vscode-jest; do
	code --install-extension "$extension" >/dev/null
done

# --- Claude Code memory ------------------------------------------------------
claude_dir="$HOME/.claude"
mkdir -p "$claude_dir"
copy_if_missing "$script_dir/claude/MEMORY.md" "$claude_dir/MEMORY.md" "Copying Claude memory"
claude_md="$claude_dir/CLAUDE.md"
touch "$claude_md"
if ! grep -qxF '@~/.claude/MEMORY.md' "$claude_md"; then
	printf '@~/.claude/MEMORY.md\n\n%s\n' "$(cat "$claude_md")" >"$claude_md"
fi

# --- MCP servers -------------------------------------------------------------
copy_if_missing "$script_dir/mcp-config.json" "$HOME/.copilot/mcp-config.json" "Copying MCP config"

# --- CI runner ---------------------------------------------------------------
read -rp "Register this Mac as a GitHub Actions runner for workbench-soft? [y/N] " runner_answer
if [[ $runner_answer =~ ^(y|yes)$ ]]; then
	"$script_dir/runner/install.sh"
fi

step "Done. Open a new terminal to pick up the PATH and mise."
