<div align="center">

# 🚀 Open in Editor

**Open files and folders from Obsidian in your favorite external code editor — one right-click away.**

[![Release](https://img.shields.io/github/v/release/PriyanshuMallick/Obsidian_open_in_editor?style=flat-square&label=release)](https://github.com/PriyanshuMallick/Obsidian_open_in_editor/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/PriyanshuMallick/Obsidian_open_in_editor/total?style=flat-square)](https://github.com/PriyanshuMallick/Obsidian_open_in_editor/releases)
[![License](https://img.shields.io/github/license/PriyanshuMallick/Obsidian_open_in_editor?style=flat-square)](LICENSE)
[![Obsidian](https://img.shields.io/badge/Obsidian-Plugin-7C3AED?style=flat-square&logo=obsidian&logoColor=white)](https://obsidian.md)

</div>

---

Obsidian is great for writing, but sometimes you need a real code editor. **Open in Editor** adds a context-menu entry to files, folders, and editor tabs so you can jump straight into **VS Code, Cursor, Zed, Windsurf, Antigravity** — or any editor you configure.

## 💡 Why I built this

Editing in Obsidian gets tedious once you want the power of a real code editor. Things a code editor does far better:

- **Multi-cursor / multi-line edits** — `Cmd/Ctrl + Opt/Alt + ↓` to select multiple lines and edit them all at once
- **Bulk special tags or numbering** across many lines in one pass
- **Inline tab auto-complete**

I also just prefer editing in an editor — that's where I feel most at home. So instead of fighting the note pane, this plugin lets me pop any note straight into the editor and get back to Obsidian when done.

## ✨ Features

- 🖱️ **Context menu integration** — Right-click any file, folder, or editor tab to open it externally
- 📦 **Built-in editor support** — Pre-configured for **VS Code, Cursor, Zed, Windsurf, and Antigravity**
- 🛠️ **Custom editors** — Add any editor with your own command and arguments
- 🗂️ **Flexible menus** — Group editors under a submenu, or show them directly in the context menu
- ⌨️ **Command palette** — A quick command for each enabled editor

## 📥 Installation

### From GitHub Releases (Recommended)

1. Go to the [**latest release**](https://github.com/PriyanshuMallick/Obsidian_open_in_editor/releases/latest)
2. Download `open-in-editor.zip`
3. Extract it — you'll get `main.js`, `manifest.json`, and `styles.css`
4. Copy all three files into `<vault>/.obsidian/plugins/open-in-editor/` (create the folder if it doesn't exist)
5. Reload Obsidian
6. Enable the plugin in **Settings → Community Plugins**

> 💡 Prefer the individual files? Each release also ships `main.js`, `manifest.json`, and `styles.css` as separate downloads.

### From Obsidian Community Plugins (Coming Soon)

1. Open **Settings → Community Plugins**
2. Browse and search for **"Open in Editor"**
3. Install and enable

### Development Installation

```bash
cd <vault>/.obsidian/plugins
git clone https://github.com/PriyanshuMallick/Obsidian_open_in_editor.git open-in-editor
cd open-in-editor
bun install
./build.sh
```

Then reload Obsidian and enable the plugin.

## 🚦 Usage

### Enable your editors

1. Go to **Settings → Open in Editor**
2. Toggle on the editors you want
3. Optionally enable **"Group in submenu"** to tuck them under a single menu entry

### Open a file or folder

| Where | How |
|-------|-----|
| **File Explorer** | Right-click any file or folder |
| **Editor Tab** | Right-click the tab of an open file |
| **Command Palette** | `Ctrl/Cmd + P` → search **"Open in [Editor]"** |

### Custom editors

Add your own editor in **Settings → Open in Editor → Custom Editors**:

1. Click **Add Custom Editor**
2. Fill in:
   - **Name** — display name
   - **Command** — executable (e.g. `vim`, `/usr/local/bin/subl`)
   - **Arguments** — optional; use `${file}` for the file path, `${folder}` for the vault path
3. Enable it

**Examples**

| Editor | Command | Arguments |
|--------|---------|-----------|
| Sublime Text | `subl` | `${file}` |
| Neovim | `nvim` | `${file}` |
| IntelliJ IDEA | `idea` | `${file}` |

## 🧑‍💻 Development

```bash
# Production build
./build.sh

# Development (watch mode)
bun run dev
```

**Requirements**

- [Bun](https://bun.sh/)
- Node.js v16 or higher

> ⚠️ This is a **desktop-only** plugin — it launches native editors and won't run on Obsidian Mobile.

## 📝 Changelog

### 1.0.0 — Initial Release

- Context menu integration for files, folders, and editor tabs
- Built-in support for VS Code, Cursor, Zed, Windsurf, and Antigravity
- Custom editor configuration
- Menu grouping options
- Command palette integration

## 🤝 Support

If you find this plugin useful:

- ⭐ Star the repo on GitHub
- 🐛 Report issues or suggest features
- 🔧 Contribute improvements via PR

## 📄 License

[MIT](LICENSE) © **Priyanshu Mallick** · [GitHub](https://github.com/PriyanshuMallick)
