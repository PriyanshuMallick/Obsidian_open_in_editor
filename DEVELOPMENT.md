# Manual install and development

## Install from GitHub

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/PriyanshuMallick/Obsidian_open_in_editor/releases/latest).
2. Copy the files into `<vault>/.obsidian/plugins/open-in-editor/`.
3. Reload Obsidian and enable **Open in Editor** under **Settings → Community plugins**.

## Build from source

Run `bun install` and `bun run build` from the repository root. Follow the manual install steps using `dist/main.js`, `manifest.json`, and `styles.css` from your checkout.

## Desktop access

When you choose an editor, the plugin passes the selected vault path to that application as a separate argument and starts it without a shell. On Windows, the plugin checks for the built-in editor executables and their launchers on your system PATH. These checks only check whether a path exists.
