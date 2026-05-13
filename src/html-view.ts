import { FileView, TFile, WorkspaceLeaf, setIcon } from "obsidian";
import HtmlViewerPlugin from "./main";
import { ResourceRewriter } from "./resource-rewriter";

export const HTML_VIEW_TYPE = "html-view";

export class HtmlView extends FileView {
	plugin: HtmlViewerPlugin;
	iframeEl: HTMLIFrameElement | null = null;
	toolbarEl: HTMLElement | null = null;
	statusEl: HTMLElement | null = null;
	viewerContainerEl: HTMLElement | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: HtmlViewerPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.registerEvent(
			this.app.vault.on("modify", async (changedFile) => {
				if (this.file && changedFile.path === this.file.path) {
					await this.renderFile(this.file);
				}
			})
		);
	}

	getViewType(): string {
		return HTML_VIEW_TYPE;
	}

	getDisplayText(): string {
		return this.file?.basename ?? "HTML";
	}

	getIcon(): string {
		return "file-code";
	}

	async onLoadFile(file: TFile): Promise<void> {
		this.buildToolbar();
		await this.renderFile(file);
	}

	async onUnloadFile(_file: TFile): Promise<void> {
		this.cleanup();
	}

	private buildToolbar(): void {
		this.contentEl.empty();
		this.contentEl.addClass("html-viewer-content");

		this.toolbarEl = this.contentEl.createDiv("html-viewer-toolbar");

		const refreshBtn = this.toolbarEl.createEl("button", {
			cls: "clickable-icon",
			attr: { "aria-label": "Refresh" },
		});
		setIcon(refreshBtn, "refresh-cw");
		refreshBtn.addEventListener("click", () => {
			if (this.file) this.renderFile(this.file);
		});

		const sourceBtn = this.toolbarEl.createEl("button", {
			cls: "clickable-icon",
			attr: { "aria-label": "Open source" },
		});
		setIcon(sourceBtn, "code");
		sourceBtn.addEventListener("click", () => {
			if (this.file) this.openSource(this.file);
		});

		const externalBtn = this.toolbarEl.createEl("button", {
			cls: "clickable-icon",
			attr: { "aria-label": "Open externally" },
		});
		setIcon(externalBtn, "external-link");
		externalBtn.addEventListener("click", () => {
			if (this.file) this.openExternally(this.file);
		});

		this.statusEl = this.toolbarEl.createSpan("html-viewer-status");

		this.viewerContainerEl = this.contentEl.createDiv("html-viewer-container");
	}

	private async renderFile(file: TFile): Promise<void> {
		if (!this.viewerContainerEl) return;

		this.viewerContainerEl.empty();
		this.updateStatus();

		try {
			const content = await this.app.vault.cachedRead(file);
			if (!content.trim()) {
				this.showError("Empty file", file.basename);
				return;
			}

			const jsEnabled = this.isJavaScriptEnabled(file);
			const allowExternal = this.plugin.settings.allowExternalResources;

			let html = content;
			let mode: string;

			if (this.hasRelativeResources(content)) {
				const rewriter = new ResourceRewriter(this.app, file, allowExternal);
				html = await rewriter.rewrite(content);
				mode = "local";
			} else {
				mode = "srcdoc";
			}

			html = this.injectCsp(html, jsEnabled, allowExternal);

			this.iframeEl = this.viewerContainerEl.createEl("iframe", {
				cls: "html-viewer-iframe",
			});
			this.iframeEl.sandbox.add("");
			if (jsEnabled) this.iframeEl.sandbox.add("allow-scripts");
			if (this.plugin.settings.allowForms) this.iframeEl.sandbox.add("allow-forms");

			this.iframeEl.srcdoc = html;
			this.updateStatus(jsEnabled, mode);
		} catch (err) {
			this.showError(String(err), file.basename);
		}
	}

	private hasRelativeResources(content: string): boolean {
		// Quick heuristic: look for relative path patterns in common resource attributes.
		const pattern = /(?:src|href)\s*=\s*["'](?!https?:\/\/|data:|blob:|\/\/|javascript:|mailto:|#|\s*$)[^"']+["']/i;
		return pattern.test(content);
	}

	private injectCsp(html: string, jsEnabled: boolean, allowExternal: boolean): string {

		let csp = "default-src 'none'; ";
		csp += "img-src app: blob: data: " + (allowExternal ? "http: https:; " : "; ");
		csp += "media-src app: blob: data: " + (allowExternal ? "http: https:; " : "; ");
		csp += "font-src app: blob: data: " + (allowExternal ? "http: https:; " : "; ");
		csp += "style-src app: blob: data: 'unsafe-inline'; ";
		csp += "script-src " + (jsEnabled ? "app: blob: data: 'unsafe-inline'; " : "'none'; ");
		csp += "connect-src 'none'; ";
		csp += "frame-src 'none'; ";
		csp += "form-action 'none';";

		const meta = `<meta http-equiv="Content-Security-Policy" content="${csp}">`;

		if (/<head[^>]*>/i.test(html)) {
			return html.replace(/(<head[^>]*>)/i, `$1${meta}`);
		}
		if (/<html[^>]*>/i.test(html)) {
			return html.replace(/(<html[^>]*>)/i, `$1<head>${meta}</head>`);
		}
		return `<head>${meta}</head>${html}`;
	}

	private isJavaScriptEnabled(file: TFile): boolean {
		if (this.plugin.settings.enableJavaScript) return true;

		const trusted = this.plugin.settings.trustedFolders
			.split(",")
			.map((s) => s.trim())
			.filter((s) => s.length > 0);

		for (const folder of trusted) {
			if (file.path.startsWith(folder + "/") || file.path === folder) {
				return true;
			}
		}
		return false;
	}

	private updateStatus(jsEnabled?: boolean, mode?: string): void {
		if (!this.statusEl) return;
		const parts: string[] = [];
		if (jsEnabled !== undefined) {
			parts.push(`JS: ${jsEnabled ? "on" : "off"}`);
		}
		if (mode) {
			parts.push(`Mode: ${mode}`);
		}
		this.statusEl.textContent = parts.join(" · ") || "";
	}

	private showError(message: string, filename: string): void {
		if (!this.viewerContainerEl) return;
		this.viewerContainerEl.empty();
		const errorEl = this.viewerContainerEl.createDiv("html-viewer-error");
		errorEl.createEl("h3", { text: `Failed to load ${filename}` });
		errorEl.createEl("p", { text: message });

		const actions = errorEl.createDiv("html-viewer-error-actions");
		const reloadBtn = actions.createEl("button", { text: "Reload" });
		reloadBtn.addEventListener("click", () => {
			if (this.file) this.renderFile(this.file);
		});

		if (this.file) {
			const sourceBtn = actions.createEl("button", { text: "Open source" });
			sourceBtn.addEventListener("click", () => this.openSource(this.file!));
		}
	}

	private openSource(file: TFile): void {
		this.app.workspace.openLinkText(file.path, "", false);
	}

	private openExternally(file: TFile): void {
		const electron = (window as unknown as { require?: (name: string) => unknown }).require?.("electron");
		if (electron) {
			const adapter = this.app.vault.adapter as unknown as { getFullPath: (path: string) => string };
			const filePath = adapter.getFullPath(file.path);
			(electron as { shell: { openPath: (path: string) => void } }).shell.openPath(filePath);
		} else {
			window.open(this.app.vault.getResourcePath(file), "_blank");
		}
	}

	private cleanup(): void {
		if (this.iframeEl) {
			this.iframeEl.srcdoc = "";
			this.iframeEl.remove();
			this.iframeEl = null;
		}
		if (this.toolbarEl) {
			this.toolbarEl.remove();
			this.toolbarEl = null;
		}
		if (this.viewerContainerEl) {
			this.viewerContainerEl.remove();
			this.viewerContainerEl = null;
		}
		this.contentEl.empty();
	}
}
