import { App, PluginSettingTab, Setting } from "obsidian";
import HtmlViewerPlugin from "./main";

export interface HtmlViewerSettings {
	enableJavaScript: boolean;
	allowExternalResources: boolean;
	allowForms: boolean;
	trustedFolders: string;
}

export const DEFAULT_SETTINGS: HtmlViewerSettings = {
	enableJavaScript: false,
	allowExternalResources: false,
	allowForms: false,
	trustedFolders: "",
};

export class HtmlViewerSettingTab extends PluginSettingTab {
	plugin: HtmlViewerPlugin;

	constructor(app: App, plugin: HtmlViewerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "HTML Viewer Settings" });

		new Setting(containerEl)
			.setName("Enable JavaScript")
			.setDesc("Allow scripts to run inside HTML views. Only enable for trusted HTML files.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableJavaScript)
					.onChange(async (value) => {
						this.plugin.settings.enableJavaScript = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Allow external resources")
			.setDesc("Allow loading resources from external URLs (http/https). When disabled, only vault-local resources are loaded.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.allowExternalResources)
					.onChange(async (value) => {
						this.plugin.settings.allowExternalResources = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Allow forms")
			.setDesc("Allow form submission inside HTML views.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.allowForms)
					.onChange(async (value) => {
						this.plugin.settings.allowForms = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Trusted folders")
			.setDesc("Comma-separated list of folder paths where JavaScript is always allowed. Overrides the global toggle.")
			.addText((text) =>
				text
					.setPlaceholder("notes/trusted, archive/html")
					.setValue(this.plugin.settings.trustedFolders)
					.onChange(async (value) => {
						this.plugin.settings.trustedFolders = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
