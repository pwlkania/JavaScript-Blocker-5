#!/bin/bash
MAIN_DIR="/Users/Travis/Documents/Extensions/JS Blocker/JavaScript Blocker 5.git.safariextension"
# BETA_DIR="/Users/Travis/Documents/Extensions/JS Blocker/JavaScript Blocker 5.BETA.safariextension"
cd "$MAIN_DIR/js/"

echo -n > injected/compiled.js

# echo "console.time('JSB Injected');" > injected/compiled.js

/bin/cat safari.js promise.js utilities.js event.js store.js injected/commands.js injected/blocker.js injected/deepInject.js injected/notification.js injected/special.js injected/specials.js injected/userScript.js >> injected/compiled.js

# rm "$BETA_DIR/js/injected/compiled.js"

# /Users/Travis/bin/link_directory.sh "$MAIN_DIR" "$BETA_DIR"

# echo "console.timeEnd('JSB Injected');" >> injected/compiled.js
