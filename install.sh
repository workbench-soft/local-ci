#!/usr/bin/env bash
# Installs everything README.md lists. Safe to run again: each step checks
# whether its piece is already in place.
set -euo pipefail

dev_dir="$HOME/Documents/Dev"
script_dir=$(cd "$(dirname "$0")" && pwd)

say() { printf '\n==> %s\n' "$*"; }

# --- Homebrew ---------------------------------------------------------------
if ! command -v brew >/dev/null 2>&1; then
	say "Installing Homebrew"
	/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi
eval "$(/opt/homebrew/bin/brew shellenv)"

say "Installing brew formulae"
brew install git gh mise fzf jq shellcheck shfmt terminal-notifier mkcert agent-browser

say "Installing brew casks"
brew install --cask visual-studio-code docker-desktop maccy claude android-platform-tools

# --- Oh My Zsh ---------------------------------------------------------------
if [ ! -d "$HOME/.oh-my-zsh" ]; then
	say "Installing Oh My Zsh"
	RUNZSH=no KEEP_ZSHRC=yes sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
fi

# --- .zshrc lines ------------------------------------------------------------
zshrc="$HOME/.zshrc"
touch "$zshrc"
add_line() {
	grep -qxF "$1" "$zshrc" || printf '%s\n' "$1" >>"$zshrc"
}
say "Updating .zshrc"
# shellcheck disable=SC2016  # the lines land in .zshrc as written, unexpanded
add_line 'export PATH="$HOME/.local/bin:$PATH"'
# shellcheck disable=SC2016
add_line 'eval "$(mise activate zsh)"'

# --- Node toolchain ----------------------------------------------------------
say "Installing node, pnpm and yarn through mise"
mise use -g node@22 pnpm@latest yarn@1

say "Installing the Copilot CLI"
mise exec -- npm install -g @github/copilot

# --- Git config --------------------------------------------------------------
say "Setting git config"
git config --global color.ui true
git config --global push.autosetupremote true
if [ -z "$(git config --global user.name || true)" ]; then
	read -rp "git user.name: " git_name
	git config --global user.name "$git_name"
fi
if [ -z "$(git config --global user.email || true)" ]; then
	read -rp "git user.email: " git_email
	git config --global user.email "$git_email"
fi

# --- GitHub CLI --------------------------------------------------------------
# The repos below are private in workbench-soft, so the login comes first.
if ! gh auth status >/dev/null 2>&1; then
	say "Logging into GitHub"
	gh auth login
fi

# --- My repos ----------------------------------------------------------------
mkdir -p "$dev_dir"
for repo in git-aliases agent-skills gh-review-notify; do
	dir="$dev_dir/$repo"
	if [ ! -d "$dir" ]; then
		say "Cloning $repo"
		gh repo clone "workbench-soft/$repo" "$dir"
	fi
	say "Running $repo/install.sh"
	"$dir/install.sh"
done

# --- gh extensions -----------------------------------------------------------
if ! gh extension list 2>/dev/null | grep -q gh-stack; then
	say "Installing gh-stack"
	gh extension install github/gh-stack
fi

# --- Teamwork Graph CLI ------------------------------------------------------
# The installer asks to accept Atlassian's terms and to log in, then adds the
# upkeep LaunchAgent that keeps twg updated.
if [ ! -x "$HOME/.local/bin/twg" ]; then
	say "Installing twg"
	bash <(curl -fsSL https://teamwork-graph.atlassian.com/cli/install)
fi

# --- VS Code extensions ------------------------------------------------------
say "Installing VS Code extensions"
for ext in \
	anthropic.claude-code \
	dbaeumer.vscode-eslint \
	esbenp.prettier-vscode \
	formulahendry.auto-rename-tag \
	huizhou.githd \
	nrwl.angular-console \
	oleg-chibikov.open-in-remote-repo \
	orta.vscode-jest; do
	code --install-extension "$ext" >/dev/null
done

# --- Claude Code memory ------------------------------------------------------
claude_dir="$HOME/.claude"
mkdir -p "$claude_dir"
if [ ! -f "$claude_dir/MEMORY.md" ]; then
	say "Copying Claude memory"
	cp "$script_dir/claude/MEMORY.md" "$claude_dir/MEMORY.md"
fi
touch "$claude_dir/CLAUDE.md"
if ! grep -qxF '@~/.claude/MEMORY.md' "$claude_dir/CLAUDE.md"; then
	printf '@~/.claude/MEMORY.md\n\n%s\n' "$(cat "$claude_dir/CLAUDE.md")" >"$claude_dir/CLAUDE.md"
fi

# --- MCP servers -------------------------------------------------------------
if [ ! -f "$HOME/.copilot/mcp-config.json" ]; then
	say "Copying MCP config"
	mkdir -p "$HOME/.copilot"
	cp "$script_dir/mcp-config.json" "$HOME/.copilot/mcp-config.json"
fi

say "Done. Open a new terminal to pick up the PATH and mise."
