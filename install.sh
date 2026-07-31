#!/bin/bash

echo ""
echo "  ================ NexAnime Installer ================"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

# Check Node.js
if ! command -v node &>/dev/null; then
    echo "  [ERROR] Node.js is not installed."
    echo "  Download it from https://nodejs.org"
    exit 1
fi

# Check npm
if ! command -v npm &>/dev/null; then
    echo "  [ERROR] npm is not installed."
    exit 1
fi

echo "  [1/4] Installing dependencies..."
if ! npm install; then
    echo "  [ERROR] npm install failed."
    exit 1
fi

echo ""
echo "  [2/4] Building NexAnime (this may take a minute)..."
if ! npm run build; then
    echo "  [ERROR] Build failed."
    exit 1
fi

# Verify production build was created
if [ ! -f ".next/BUILD_ID" ]; then
    echo "  [ERROR] Build completed but no production build was found."
    echo "  Run 'npm run build' manually and check for errors."
    exit 1
fi

echo ""
echo "  [3/4] Creating nexanime command..."

# Create nexanime script in project root
cat > "$SCRIPT_DIR/nexanime" << 'NEXEOF'
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
node "$SCRIPT_DIR/bin/nexanime.js" "$@"
NEXEOF
chmod +x "$SCRIPT_DIR/nexanime"

echo ""
echo "  [4/4] Adding NexAnime to your PATH..."

# Determine shell config file
SHELL_CONFIG=""
if [ -f "$HOME/.zshrc" ]; then
    SHELL_CONFIG="$HOME/.zshrc"
elif [ -f "$HOME/.bashrc" ]; then
    SHELL_CONFIG="$HOME/.bashrc"
elif [ -f "$HOME/.bash_profile" ]; then
    SHELL_CONFIG="$HOME/.bash_profile"
elif [ -f "$HOME/.profile" ]; then
    SHELL_CONFIG="$HOME/.profile"
fi

if [ -n "$SHELL_CONFIG" ]; then
    # Check if already added (match as whole PATH entry, not substring)
    if grep -qE "(^|:)\Q$SCRIPT_DIR\E(:|$)" "$SHELL_CONFIG" 2>/dev/null || grep -qF "export PATH=\"\$PATH:$SCRIPT_DIR\"" "$SHELL_CONFIG" 2>/dev/null; then
        echo "  NexAnime is already in your PATH."
    else
        echo "" >> "$SHELL_CONFIG"
        echo "# NexAnime CLI" >> "$SHELL_CONFIG"
        echo "export PATH=\"\$PATH:$SCRIPT_DIR\"" >> "$SHELL_CONFIG"
        export PATH="$PATH:$SCRIPT_DIR"
        echo "  NexAnime added to $SHELL_CONFIG"
    fi
else
    echo "  [WARNING] Could not find shell config file."
    echo "  Add this line to your .bashrc or .zshrc:"
    echo "    export PATH=\"\$PATH:$SCRIPT_DIR\""
fi

echo ""
echo "  =============== Installation Complete ================"
echo ""
echo "  Open a NEW terminal and type:"
echo ""
echo "      nexanime"
echo ""
echo "  to start NexAnime."
echo ""
