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
		this.app.workspace.detachLeavesOfType(HTML_VIEW_TYPE);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
