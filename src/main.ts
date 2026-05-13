import { Plugin } from "obsidian";
import { DEFAULT_SETTINGS, HtmlViewerSettings, HtmlViewerSettingTab } from "./settings";
import { HTML_VIEW_TYPE, HtmlView } from "./html-view";

export default class HtmlViewerPlugin extends Plugin {
	settings: HtmlViewerSettings;

	async onload() {
		await this.loadSettings();

		this.registerView(
			HTML_VIEW_TYPE,
			(leaf) => new HtmlView(leaf, this)
		);

		this.registerExtensions(["html", "htm"], HTML_VIEW_TYPE);
		this.addSettingTab(new HtmlViewerSettingTab(this.app, this));
	}

	onunload() {
		// Obsidian unloads registered views; leave workspace layout intact.
	}

	async loadSettings() {
		const loadedSettings = await this.loadData() as Partial<HtmlViewerSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedSettings);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
