import { expect, mock, test } from "bun:test";
import type { App, PluginManifest } from "obsidian";

interface Row {
	setClass(): void;
	settingEl: {
		querySelector(selector: string): { remove(): void } | undefined;
		createDiv(className: string): object;
	};
	controlEl: { empty(): void };
}

interface SettingsTab {
	getSettingDefinitions(): { name: string; render(row: Row): void }[];
	createBuiltInEditorSetting(): void;
	createCustomEditorSetting(): void;
	addCustomEditorButton(row: Row): void;
}

let tab: SettingsTab;
mock.module("obsidian", () => ({
	FileSystemAdapter: class {},
	Menu: class {},
	Notice: class {},
	Setting: class {},
	Plugin: class {
		app = { workspace: { on() {} } };
		async loadData() {
			return { customEditors: [{ id: "custom", name: "Example", enabled: false }] };
		}
		registerEvent() {}
		addCommand() {}
		addSettingTab(settings: SettingsTab) { tab = settings; }
	},
	PluginSettingTab: class {},
}));

const { default: OpenInEditor } = await import("../src/main");

test("refreshing reused settings rows keeps one set of controls", async () => {
	await new OpenInEditor({} as App, {} as PluginManifest).onload();
	tab.createBuiltInEditorSetting = () => {};
	tab.createCustomEditorSetting = () => {};
	const definitions = tab.getSettingDefinitions();

	for (const name of ["VS Code", "Cursor", "Custom editor: Example (1)", "Add custom editor"]) {
		const rendered: { className: string; remove(): void }[] = [];
		const buttons: string[] = [];
		tab.addCustomEditorButton = () => { buttons.push("Add Custom Editor"); };
		const row: Row = {
			setClass() {},
			settingEl: {
				querySelector(selector) {
					expect(selector).toBe(":scope > .open-in-editor-settings");
					return rendered.find((child) => child.className === "open-in-editor-settings");
				},
				createDiv(className) {
					const child = {
						className,
						remove() { rendered.splice(rendered.indexOf(child), 1); },
					};
					rendered.push(child);
					return child;
				},
			},
			controlEl: { empty() { buttons.length = 0; } },
		};

		const definition = definitions.find((definition) => definition.name === name);
		if (!definition) throw new Error(`Missing settings row for ${name}`);
		for (let refresh = 0; refresh < 7; refresh++) definition.render(row);
		expect(rendered.length + buttons.length).toBe(1);
	}
});
