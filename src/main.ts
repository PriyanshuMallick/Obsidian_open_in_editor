import {
	App,
	loadMermaid,
	Menu,
	MenuItem,
	Modal,
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
	mermaidExport: MermaidExportSettings;
}

type MermaidExportBackground = "transparent" | "solid";
type MermaidExportTheme = "light" | "dark";
type MermaidExportScale = 1 | 2 | 3 | 4;
type MermaidExportFormat = "png" | "svg";

interface MermaidExportSettings {
	background: MermaidExportBackground;
	theme: MermaidExportTheme;
	scale: MermaidExportScale;
	format: MermaidExportFormat;
}

interface MermaidDiagramTarget {
	element: Element;
	source: string;
}

const MERMAID_EXPORT_DEFAULTS: MermaidExportSettings = {
	background: "solid",
	theme: "light",
	scale: 4,
	format: "png",
};

// ============================================================================
// Built-in Editors
// ============================================================================

const BUILT_IN_EDITORS: Omit<EditorConfig, "enabled" | "grouped">[] = [
	{ id: "vscode", name: "VS Code", appName: "Visual Studio Code", command: "code", isBuiltIn: true },
	{ id: "cursor", name: "Cursor", appName: "Cursor", command: "cursor", isBuiltIn: true },
	{ id: "zed", name: "Zed", appName: "Zed", command: "zed", isBuiltIn: true },
	{ id: "windsurf", name: "Windsurf", appName: "Windsurf", command: "windsurf", isBuiltIn: true },
	{ id: "antigravity", name: "Antigravity", appName: "Antigravity", command: "antigravity", isBuiltIn: true },
];

const DEFAULT_SETTINGS: PluginSettings = {
	builtInEditors: Object.fromEntries(
		BUILT_IN_EDITORS.map((e) => [e.id, { enabled: false, grouped: false }])
	),
	customEditors: [],
	mermaidExport: { ...MERMAID_EXPORT_DEFAULTS },
};

// ============================================================================
// Plugin
// ============================================================================

export default class OpenInEditorPlugin extends Plugin {
	settings: PluginSettings;
	private mermaidSources = new WeakMap<Element, string>();

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

		this.registerMermaidExporter();
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
		const loaded = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);
		this.settings.mermaidExport = Object.assign(
			{},
			MERMAID_EXPORT_DEFAULTS,
			loaded?.mermaidExport
		);
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

	registerMermaidExporter() {
		this.registerMarkdownPostProcessor((el, ctx) => {
			const sectionInfo = ctx.getSectionInfo(el);
			const source = sectionInfo ? this.extractMermaidSource(sectionInfo.text) : null;
			if (!source) return;

			this.mermaidSources.set(el, source);
			this.tagMermaidElements(el, source);
			window.setTimeout(() => this.tagMermaidElements(el, source), 50);
			window.setTimeout(() => this.tagMermaidElements(el, source), 250);
		}, 100);

		this.registerDomEvent(document, "contextmenu", (evt: MouseEvent) => {
			const target = this.getMermaidDiagramTarget(evt);
			if (!target) return;

			evt.preventDefault();
			evt.stopPropagation();

			const menu = Menu.forEvent(evt);
			menu.addItem((item) => {
				item
					.setTitle("Export Mermaid Diagram")
					.setIcon("image")
					.onClick(() => {
						new MermaidExportModal(this.app, this, target.source).open();
					});
			});
			menu.showAtMouseEvent(evt);
		});
	}

	extractMermaidSource(sectionText: string): string | null {
		const fenceMatch = sectionText.match(/^\s*```\s*mermaid[^\n]*\n([\s\S]*?)\n\s*```\s*$/m);
		if (fenceMatch?.[1]?.trim()) {
			return fenceMatch[1].trim();
		}

		const colonMatch = sectionText.match(/^\s*:::\s*mermaid[^\n]*\n([\s\S]*?)\n\s*:::\s*$/m);
		if (colonMatch?.[1]?.trim()) {
			return colonMatch[1].trim();
		}

		return null;
	}

	findMermaidElements(root: HTMLElement): Element[] {
		const elements = new Set<Element>();
		for (const selector of [
			".mermaid",
			".block-language-mermaid",
			".mermaid svg",
			".block-language-mermaid svg",
		]) {
			for (const el of Array.from(root.querySelectorAll(selector))) {
				elements.add(el);
			}
		}
		return Array.from(elements);
	}

	tagMermaidElements(root: HTMLElement, source: string) {
		for (const diagramEl of this.findMermaidElements(root)) {
			this.mermaidSources.set(diagramEl, source);
		}
	}

	getMermaidDiagramTarget(evt: MouseEvent): MermaidDiagramTarget | null {
		const eventTarget = evt.target;
		if (!(eventTarget instanceof Element)) return null;

		const diagramEl = eventTarget.closest(".mermaid, .block-language-mermaid");
		if (!diagramEl) return null;

		const candidates: Element[] = [];
		let current: Element | null = eventTarget;
		while (current && current !== document.body) {
			candidates.push(current);
			current = current.parentElement;
		}

		for (const candidate of candidates) {
			const source = this.mermaidSources.get(candidate);
			if (source) {
				return { element: candidate, source };
			}
		}

		const source = this.mermaidSources.get(diagramEl);
		return source ? { element: diagramEl, source } : null;
	}

	getMermaidExportDefaults(): MermaidExportSettings {
		return { ...MERMAID_EXPORT_DEFAULTS, ...this.settings.mermaidExport };
	}

	async exportMermaidDiagram(source: string, options: MermaidExportSettings) {
		try {
			const svg = await this.renderMermaidSvg(source, options);
			const filename = this.createMermaidExportFilename(options.format);

			if (options.format === "svg") {
				this.downloadBlob(svg, "image/svg+xml;charset=utf-8", filename);
			} else {
				const blob = await this.renderSvgToPngBlob(svg, options);
				this.downloadBlob(blob, "image/png", filename);
			}

			new Notice(`Exported Mermaid diagram as ${options.format.toUpperCase()}`);
		} catch (error) {
			console.error("Failed to export Mermaid diagram:", error);
			new Notice(`Failed to export Mermaid diagram: ${this.getErrorMessage(error)}`);
		}
	}

	async renderMermaidSvg(source: string, options: MermaidExportSettings): Promise<string> {
		const mermaid = await loadMermaid();
		const theme = options.theme === "dark" ? "dark" : "default";

		mermaid.initialize({
			startOnLoad: false,
			theme,
			securityLevel: "strict",
		});

		if (typeof mermaid.parse === "function") {
			await mermaid.parse(source);
		}

		const id = `open-in-editor-mermaid-export-${Date.now()}-${Math.random()
			.toString(36)
			.slice(2)}`;
		const { svg } = await mermaid.render(id, source);
		return this.prepareSvgForExport(svg, options);
	}

	prepareSvgForExport(svgText: string, options: MermaidExportSettings): string {
		const parser = new DOMParser();
		const doc = parser.parseFromString(svgText, "image/svg+xml");
		const parserError = doc.querySelector("parsererror");
		if (parserError) {
			throw new Error("Rendered SVG could not be parsed.");
		}

		const svg = doc.documentElement;
		if (svg.tagName.toLowerCase() !== "svg") {
			throw new Error("Mermaid did not return an SVG.");
		}

		svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
		if (options.background === "transparent") {
			svg.style.backgroundColor = "transparent";
			svg.setAttribute("style", this.removeBackgroundFromStyle(svg.getAttribute("style") ?? ""));
		} else {
			svg.style.backgroundColor = this.getSolidBackgroundColor(options.theme);
		}

		return new XMLSerializer().serializeToString(svg);
	}

	async renderSvgToPngBlob(
		svgText: string,
		options: MermaidExportSettings
	): Promise<Blob> {
		const image = await this.loadSvgImage(svgText);
		const dimensions = this.getSvgDimensions(svgText, image);
		const canvas = document.createElement("canvas");
		canvas.width = Math.ceil(dimensions.width * options.scale);
		canvas.height = Math.ceil(dimensions.height * options.scale);

		const ctx = canvas.getContext("2d");
		if (!ctx) {
			throw new Error("Could not create a canvas context.");
		}

		if (options.background === "solid") {
			ctx.fillStyle = this.getSolidBackgroundColor(options.theme);
			ctx.fillRect(0, 0, canvas.width, canvas.height);
		}

		ctx.setTransform(options.scale, 0, 0, options.scale, 0, 0);
		ctx.drawImage(image, 0, 0, dimensions.width, dimensions.height);

		return new Promise((resolve, reject) => {
			canvas.toBlob((blob) => {
				if (blob) {
					resolve(blob);
				} else {
					reject(new Error("Could not create a PNG from the rendered diagram."));
				}
			}, "image/png");
		});
	}

	loadSvgImage(svgText: string): Promise<HTMLImageElement> {
		return new Promise((resolve, reject) => {
			const image = new Image();
			const url = URL.createObjectURL(
				new Blob([svgText], { type: "image/svg+xml;charset=utf-8" })
			);

			image.onload = () => {
				URL.revokeObjectURL(url);
				resolve(image);
			};
			image.onerror = () => {
				URL.revokeObjectURL(url);
				reject(new Error("Could not load the rendered SVG for PNG export."));
			};
			image.src = url;
		});
	}

	getSvgDimensions(svgText: string, image: HTMLImageElement): { width: number; height: number } {
		const parser = new DOMParser();
		const doc = parser.parseFromString(svgText, "image/svg+xml");
		const svg = doc.documentElement;
		const width = this.parseSvgLength(svg.getAttribute("width"));
		const height = this.parseSvgLength(svg.getAttribute("height"));
		if (width > 0 && height > 0) {
			return { width, height };
		}

		const viewBox = svg.getAttribute("viewBox")?.split(/\s+/).map(Number);
		if (viewBox && viewBox.length === 4 && viewBox[2] > 0 && viewBox[3] > 0) {
			return { width: viewBox[2], height: viewBox[3] };
		}

		return {
			width: image.naturalWidth || image.width,
			height: image.naturalHeight || image.height,
		};
	}

	parseSvgLength(value: string | null): number {
		if (!value) return 0;
		const parsed = Number.parseFloat(value);
		return Number.isFinite(parsed) ? parsed : 0;
	}

	removeBackgroundFromStyle(style: string): string {
		return style
			.split(";")
			.map((part) => part.trim())
			.filter((part) => part && !part.toLowerCase().startsWith("background"))
			.join("; ");
	}

	getSolidBackgroundColor(theme: MermaidExportTheme): string {
		return theme === "dark" ? "#1f2020" : "#ffffff";
	}

	downloadBlob(data: BlobPart | Blob, mimeType: string, filename: string) {
		const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = filename;
		document.body.appendChild(link);
		link.click();
		link.remove();
		window.setTimeout(() => URL.revokeObjectURL(url), 1000);
	}

	createMermaidExportFilename(format: MermaidExportFormat): string {
		const activeFile = this.app.workspace.getActiveFile();
		const baseName = activeFile?.basename ?? "mermaid-diagram";
		const timestamp = new Date()
			.toISOString()
			.replace(/[:.]/g, "-")
			.replace("T", "-")
			.slice(0, 19);
		return `${baseName}-mermaid-${timestamp}.${format}`;
	}

	getErrorMessage(error: unknown): string {
		if (error instanceof Error && error.message) {
			return error.message;
		}
		if (typeof error === "string") {
			return error;
		}
		return "Unknown error";
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
// Mermaid Export Modal
// ============================================================================

class MermaidExportModal extends Modal {
	private plugin: OpenInEditorPlugin;
	private source: string;
	private options: MermaidExportSettings;

	constructor(app: App, plugin: OpenInEditorPlugin, source: string) {
		super(app);
		this.plugin = plugin;
		this.source = source;
		this.options = plugin.getMermaidExportDefaults();
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.setTitle("Export Mermaid Diagram");

		contentEl.addClass("mermaid-export-modal");

		new Setting(contentEl)
			.setName("Format")
			.setDesc("Choose the output image format.")
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({
						png: "PNG",
						svg: "SVG",
					})
					.setValue(this.options.format)
					.onChange((value) => {
						this.options.format = value as MermaidExportFormat;
					})
			);

		new Setting(contentEl)
			.setName("Background")
			.setDesc("Use a transparent background or a solid theme background.")
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({
						solid: "Solid",
						transparent: "Transparent",
					})
					.setValue(this.options.background)
					.onChange((value) => {
						this.options.background = value as MermaidExportBackground;
					})
			);

		new Setting(contentEl)
			.setName("Theme")
			.setDesc("Render the diagram with Mermaid's light or dark theme.")
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({
						light: "Light",
						dark: "Dark",
					})
					.setValue(this.options.theme)
					.onChange((value) => {
						this.options.theme = value as MermaidExportTheme;
					})
			);

		new Setting(contentEl)
			.setName("Scale")
			.setDesc("PNG pixel density. SVG exports remain vector-based.")
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({
						"1": "1x",
						"2": "2x",
						"3": "3x",
						"4": "4x",
					})
					.setValue(String(this.options.scale))
					.onChange((value) => {
						this.options.scale = Number(value) as MermaidExportScale;
					})
			);

		const controls = contentEl.createDiv({ cls: "mermaid-export-modal-controls" });
		new Setting(controls)
			.addButton((btn) =>
				btn
					.setButtonText("Cancel")
					.onClick(() => {
						this.close();
					})
			)
			.addButton((btn) =>
				btn
					.setButtonText("Export")
					.setCta()
					.onClick(async () => {
						this.close();
						await this.plugin.exportMermaidDiagram(this.source, this.options);
					})
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}
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

		// Mermaid Export
		containerEl.createEl("h2", { text: "Mermaid Export" });
		containerEl.createEl("p", {
			text: "Defaults used when exporting a rendered Mermaid diagram from the context menu.",
			cls: "setting-item-description",
		});

		this.createMermaidExportSettings(containerEl);

		// Help
		containerEl.createEl("h2", { text: "Help" });
		containerEl.createEl("p", {
			text: 'When "Group" is enabled, the editor appears under an "Open in External Editor" submenu. For macOS, the App Name should match the application name exactly (e.g., "Visual Studio Code", "Sublime Text").',
			cls: "setting-item-description",
		});
	}

	createMermaidExportSettings(containerEl: HTMLElement) {
		const container = containerEl.createDiv({ cls: "mermaid-export-settings-container" });

		new Setting(container)
			.setName("Default format")
			.setDesc("The initially selected image format in the export dialog.")
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({
						png: "PNG",
						svg: "SVG",
					})
					.setValue(this.plugin.settings.mermaidExport.format)
					.onChange(async (value) => {
						this.plugin.settings.mermaidExport.format = value as MermaidExportFormat;
						await this.plugin.saveSettings();
					})
			);

		new Setting(container)
			.setName("Default background")
			.setDesc("The initially selected background in the export dialog.")
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({
						solid: "Solid",
						transparent: "Transparent",
					})
					.setValue(this.plugin.settings.mermaidExport.background)
					.onChange(async (value) => {
						this.plugin.settings.mermaidExport.background =
							value as MermaidExportBackground;
						await this.plugin.saveSettings();
					})
			);

		new Setting(container)
			.setName("Default theme")
			.setDesc("The initially selected theme in the export dialog.")
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({
						light: "Light",
						dark: "Dark",
					})
					.setValue(this.plugin.settings.mermaidExport.theme)
					.onChange(async (value) => {
						this.plugin.settings.mermaidExport.theme = value as MermaidExportTheme;
						await this.plugin.saveSettings();
					})
			);

		new Setting(container)
			.setName("Default PNG scale")
			.setDesc("The initially selected pixel density for PNG exports.")
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({
						"1": "1x",
						"2": "2x",
						"3": "3x",
						"4": "4x",
					})
					.setValue(String(this.plugin.settings.mermaidExport.scale))
					.onChange(async (value) => {
						this.plugin.settings.mermaidExport.scale =
							Number(value) as MermaidExportScale;
						await this.plugin.saveSettings();
					})
			);
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
