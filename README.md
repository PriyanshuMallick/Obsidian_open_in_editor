# Open in Editor

Open files and folders in external code editors directly from Obsidian.

## Features

- **Context menu integration** - Right-click on files, folders, or editor tabs to open in your favorite editor
- **Built-in editor support** - Pre-configured for VS Code, Cursor, Zed, Windsurf, and Antygravity
- **Custom editors** - Add any editor with custom commands and arguments
- **Flexible menu options** - Group editors in a submenu or show them directly in context menus
- **Command palette** - Quick commands for each enabled editor

## Installation

### From Obsidian Community Plugins (Coming Soon)

1. Open Settings → Community Plugins
2. Browse and search for "Open in Editor"
3. Install and enable

### Manual Installation

1. Download the latest release from [GitHub Releases](https://github.com/PriyanshuMallick/open-in-editor/releases)
2. Extract `main.js`, `manifest.json`, and `styles.css` to `<vault>/.obsidian/plugins/open-in-editor/`
3. Reload Obsidian
4. Enable the plugin in Settings → Community Plugins

### Development Installation

1. Clone this repo into `<vault>/.obsidian/plugins/`
   ```bash
   cd <vault>/.obsidian/plugins
   git clone https://github.com/PriyanshuMallick/open-in-editor.git
   cd open-in-editor
   ```
2. Install dependencies
   ```bash
   bun install
   ```
3. Build the plugin
   ```bash
   ./build.sh
   ```
4. Reload Obsidian and enable the plugin

## Usage

### Enabling Editors

1. Go to Settings → Open in Editor
2. Enable the editors you want to use
3. Optionally enable "Group in submenu" to organize editors under a submenu

### Opening Files

- **File Explorer**: Right-click on any file or folder
- **Editor Tab**: Right-click on the tab of an open file
- **Command Palette**: Use `Ctrl/Cmd + P` and search for "Open in [Editor]"

### Custom Editors

Add your own editors with custom commands:

1. Go to Settings → Open in Editor → Custom Editors
2. Click "Add Custom Editor"
3. Fill in:
   - **Name**: Display name for your editor
   - **Command**: Executable command (e.g., `vim`, `/usr/local/bin/subl`)
   - **Arguments**: Optional arguments (use `${file}` for file path, `${folder}` for vault path)
4. Enable the editor

**Example custom editors:**

- **Sublime Text**: Command: `subl`, Arguments: `${file}`
- **Neovim**: Command: `nvim`, Arguments: `${file}`
- **IntelliJ IDEA**: Command: `idea`, Arguments: `${file}`

## Development

### Building

```bash
# Production build
./build.sh

# Development (watch mode)
bun run dev
```

### Requirements

- [Bun](https://bun.sh/) installed
- Node.js v16 or higher (for Obsidian plugin development)

## License

MIT

## Author

**Priyanshu Mallick**
[GitHub](https://github.com/PriyanshuMallick)

## Support

If you find this plugin useful, consider:
- Starring the repo on GitHub
- Reporting issues or suggesting features
- Contributing improvements

## Changelog

### 1.0.0 (Initial Release)

- Context menu integration for files, folders, and editor tabs
- Built-in support for VS Code, Cursor, Zed, Windsurf, and Antygravity
- Custom editor configuration
- Menu grouping options
- Command palette integration
