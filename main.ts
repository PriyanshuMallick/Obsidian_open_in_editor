import {
	App,
	Menu,
	MenuItem,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TAbstractFile,
	TFile,
} from "obsidian";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// ============================================================================
// Types
// ============================================================================

interface EditorConfig {
	id: string;
	name: string;
	appName: string;  // macOS app name (e.g., "Visual Studio Code")
	command: string;  // CLI command for Windows/Linux (e.g., "code")
	enabled: boolean;
	grouped: boolean;
	isBuiltIn: boolean;
}

interface CustomEditorConfig {
	id: string;
	name: string;
	appName: string;
	command: string;
	enabled: boolean;
	grouped: boolean;
}

interface PluginSettings {
	builtInEditors: Record<string, { enabled: boolean; grouped: boolean }>;
	customEditors: CustomEditorConfig[];
}

// ============================================================================
// Built-in Editors
// ============================================================================

const BUILT_IN_EDITORS: Omit<EditorConfig, "enabled" | "grouped">[] = [
	{ id: "vscode", name: "VS Code", appName: "Visual Studio Code", command: "code", isBuiltIn: true },
	{ id: "cursor", name: "Cursor", appName: "Cursor", command: "cursor", isBuiltIn: true },
	{ id: "zed", name: "Zed", appName: "Zed", command: "zed", isBuiltIn: true },
	{ id: "windsurf", name: "Windsurf", appName: "Windsurf", command: "windsurf", isBuiltIn: true },
	{ id: "antygravity", name: "Antygravity", appName: "Antygravity", command: "antygravity", isBuiltIn: true },
];

const DEFAULT_SETTINGS: PluginSettings = {
	builtInEditors: Object.fromEntries(
		BUILT_IN_EDITORS.map((e) => [e.id, { enabled: false, grouped: false }])
	),
	customEditors: [],
};

// ============================================================================
// Plugin
// ============================================================================

export default class OpenInEditorPlugin extends Plugin {
	settings: PluginSettings;

	async onload() {
		await this.loadSettings();

		// File explorer context menu (file or folder)
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				this.addEditorMenuItems(menu, file);
			})
		);

		// Multiple files selected
		this.registerEvent(
			this.app.workspace.on("files-menu", (menu, files) => {
				if (files.length > 0) {
					this.addEditorMenuItems(menu, files[0]);
				}
			})
		);

		// Editor tab context menu
		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu, editor, view) => {
				if (view.file) {
					this.addEditorMenuItems(menu, view.file);
				}
			})
		);

		// Settings tab
		this.addSettingTab(new OpenInEditorSettingTab(this.app, this));

		// Commands for each enabled editor
		this.registerEditorCommands();
	}

	registerEditorCommands() {
		for (const editor of this.getEnabledEditors()) {
			this.addCommand({
				id: `open-in-${editor.id}`,
				name: `Open current file in ${editor.name}`,
				checkCallback: (checking: boolean) => {
					const file = this.app.workspace.getActiveFile();
					if (file) {
						if (!checking) {
							this.openInEditor(editor, file);
						}
						return true;
					}
					return false;
				},
			});
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		// Ensure all built-in editors have settings
		for (const editor of BUILT_IN_EDITORS) {
			if (!this.settings.builtInEditors[editor.id]) {
				this.settings.builtInEditors[editor.id] = { enabled: false, grouped: false };
			}
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	getEnabledEditors(): EditorConfig[] {
		const editors: EditorConfig[] = [];

		// Built-in editors
		for (const editor of BUILT_IN_EDITORS) {
			const settings = this.settings.builtInEditors[editor.id];
			if (settings?.enabled) {
				editors.push({ ...editor, enabled: true, grouped: settings.grouped });
			}
		}

		// Custom editors
		for (const custom of this.settings.customEditors) {
			if (custom.enabled) {
				editors.push({
					id: custom.id,
					name: custom.name,
					appName: custom.appName,
					command: custom.command,
					enabled: true,
					grouped: custom.grouped,
					isBuiltIn: false,
				});
			}
		}

		return editors;
	}

	addEditorMenuItems(menu: Menu, file: TAbstractFile | null) {
		const editors = this.getEnabledEditors();
		if (editors.length === 0) return;

		const groupedEditors = editors.filter((e) => e.grouped);
		const ungroupedEditors = editors.filter((e) => !e.grouped);

		// Ungrouped editors - directly in menu
		for (const editor of ungroupedEditors) {
			menu.addItem((item: MenuItem) => {
				item.setTitle(`Open in ${editor.name}`)
					.setIcon("code")
					.onClick(() => this.openInEditor(editor, file));
			});
		}

		// Grouped editors - in submenu
		if (groupedEditors.length > 0) {
			menu.addItem((item: MenuItem) => {
				item.setTitle("Open in External Editor").setIcon("code");
				const submenu = (item as any).setSubmenu() as Menu;
				for (const editor of groupedEditors) {
					submenu.addItem((subItem: MenuItem) => {
						subItem
							.setTitle(editor.name)
							.setIcon("code")
							.onClick(() => this.openInEditor(editor, file));
					});
				}
			});
		}
	}

	async openInEditor(editor: EditorConfig, file: TAbstractFile | null) {
		try {
			let filePath: string;
			if (file && file instanceof TFile) {
				filePath = this.app.vault.adapter.getFullPath(file.path);
			} else if (file) {
				// It's a folder
				filePath = this.app.vault.adapter.getFullPath(file.path);
			} else {
				// No file, open vault root
				filePath = (this.app.vault.adapter as any).basePath;
			}

			let command: string;

			if (process.platform === "darwin") {
				// macOS: Use 'open -a' to open with specified app
				command = `open -a "${editor.appName}" "${filePath}"`;
			} else if (process.platform === "win32") {
				// Windows: Use 'start' command or direct path
				command = `"${editor.command}" "${filePath}"`;
			} else {
				// Linux: Use the command directly
				command = `${editor.command} "${filePath}"`;
			}

			await execAsync(command);
			new Notice(`Opening in ${editor.name}`);
		} catch (error) {
			console.error(`Error opening in ${editor.name}:`, error);
			new Notice(
				`Failed to open in ${editor.name}. Make sure ${editor.name} is installed.`
			);
		}
	}

	onunload() {}
}

// ============================================================================
// Settings Tab
// ============================================================================

class OpenInEditorSettingTab extends PluginSettingTab {
	plugin: OpenInEditorPlugin;

	constructor(app: App, plugin: OpenInEditorPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass("open-in-editor-settings");

		// Built-in Editors
		containerEl.createEl("h2", { text: "Built-in Editors" });
		containerEl.createEl("p", {
			text: "Enable editors to show them in context menus.",
			cls: "setting-item-description",
		});

		for (const editor of BUILT_IN_EDITORS) {
			this.createBuiltInEditorSetting(containerEl, editor);
		}

		// Custom Editors
		containerEl.createEl("h2", { text: "Custom Editors" });
		containerEl.createEl("p", {
			text: "Define custom editors with your own commands.",
			cls: "setting-item-description",
		});

		new Setting(containerEl).addButton((btn) =>
			btn
				.setButtonText("Add Custom Editor")
				.setCta()
				.onClick(() => {
					this.plugin.settings.customEditors.push({
						id: `custom-${Date.now()}`,
						name: "New Editor",
						appName: "",
						command: "",
						enabled: false,
						grouped: false,
					});
					this.plugin.saveSettings();
					this.display();
				})
		);

		for (let i = 0; i < this.plugin.settings.customEditors.length; i++) {
			this.createCustomEditorSetting(containerEl, i);
		}

		// Help
		containerEl.createEl("h2", { text: "Help" });
		containerEl.createEl("p", {
			text: 'When "Group" is enabled, the editor appears under an "Open in External Editor" submenu. For macOS, the App Name should match the application name exactly (e.g., "Visual Studio Code", "Sublime Text").',
			cls: "setting-item-description",
		});
	}

	createBuiltInEditorSetting(
		containerEl: HTMLElement,
		editor: Omit<EditorConfig, "enabled" | "grouped">
	) {
		const settings = this.plugin.settings.builtInEditors[editor.id];

		const container = containerEl.createDiv({ cls: "editor-setting-container" });

		// Header
		const header = container.createDiv({ cls: "editor-setting-header" });
		header.createEl("strong", { text: editor.name });

		// Controls
		const controls = container.createDiv({ cls: "editor-controls" });

		new Setting(controls)
			.setName("Enable")
			.setClass("editor-toggle-setting")
			.addToggle((toggle) =>
				toggle
					.setValue(settings.enabled)
					.onChange(async (value) => {
						this.plugin.settings.builtInEditors[editor.id].enabled = value;
						await this.plugin.saveSettings();
						// Re-render to update Group toggle state
						this.display();
					})
			);

		const groupSetting = new Setting(controls)
			.setName("Group")
			.setClass("editor-toggle-setting")
			.addToggle((toggle) =>
				toggle
					.setValue(settings.grouped)
					.setDisabled(!settings.enabled)
					.onChange(async (value) => {
						this.plugin.settings.builtInEditors[editor.id].grouped = value;
						await this.plugin.saveSettings();
					})
			);

		// Add disabled class for styling
		if (!settings.enabled) {
			groupSetting.settingEl.addClass("setting-disabled");
		}
	}

	createCustomEditorSetting(containerEl: HTMLElement, index: number) {
		const editor = this.plugin.settings.customEditors[index];

		const container = containerEl.createDiv({ cls: "custom-editor-container" });

		// Name
		new Setting(container)
			.setName("Display Name")
			.addText((text) =>
				text
					.setPlaceholder("Editor name")
					.setValue(editor.name)
					.onChange(async (value) => {
						this.plugin.settings.customEditors[index].name = value;
						await this.plugin.saveSettings();
					})
			);

		// App Name (for macOS)
		new Setting(container)
			.setName("App Name (macOS)")
			.setDesc("Exact application name as it appears in /Applications")
			.addText((text) =>
				text
					.setPlaceholder('e.g., "Sublime Text", "IntelliJ IDEA"')
					.setValue(editor.appName)
					.onChange(async (value) => {
						this.plugin.settings.customEditors[index].appName = value;
						await this.plugin.saveSettings();
					})
			);

		// Command (for Windows/Linux)
		new Setting(container)
			.setName("Command (Windows/Linux)")
			.setDesc("CLI command for non-macOS systems")
			.addText((text) =>
				text
					.setPlaceholder("e.g., subl, idea")
					.setValue(editor.command)
					.onChange(async (value) => {
						this.plugin.settings.customEditors[index].command = value;
						await this.plugin.saveSettings();
					})
			);

		// Controls
		const controls = container.createDiv({ cls: "editor-controls" });

		new Setting(controls)
			.setName("Enable")
			.setClass("editor-toggle-setting")
			.addToggle((toggle) =>
				toggle
					.setValue(editor.enabled)
					.onChange(async (value) => {
						this.plugin.settings.customEditors[index].enabled = value;
						await this.plugin.saveSettings();
						// Re-render to update Group toggle state
						this.display();
					})
			);

		const groupSetting = new Setting(controls)
			.setName("Group")
			.setClass("editor-toggle-setting")
			.addToggle((toggle) =>
				toggle
					.setValue(editor.grouped)
					.setDisabled(!editor.enabled)
					.onChange(async (value) => {
						this.plugin.settings.customEditors[index].grouped = value;
						await this.plugin.saveSettings();
					})
			);

		// Add disabled class for styling
		if (!editor.enabled) {
			groupSetting.settingEl.addClass("setting-disabled");
		}

		new Setting(controls)
			.setName("Delete")
			.setClass("editor-toggle-setting")
			.addButton((btn) =>
				btn
					.setIcon("trash")
					.setButtonText("Delete")
					.setWarning()
					.onClick(async () => {
						this.plugin.settings.customEditors.splice(index, 1);
						await this.plugin.saveSettings();
						this.display();
					})
			);
	}
}
