import { App, TFile, requestUrl } from "obsidian";

export class ResourceRewriter {
	constructor(
		private app: App,
		private sourceFile: TFile,
		private allowExternal: boolean
	) {}

	async rewrite(htmlContent: string): Promise<string> {
		const parser = new DOMParser();
		const doc = parser.parseFromString(htmlContent, "text/html");

		await this.rewriteMediaElements(doc);
		await this.inlineStylesheets(doc);
		await this.rewriteLinkElements(doc);
		this.rewriteInlineStyles(doc);

		return this.serializeDocument(doc, htmlContent);
	}

	private async rewriteMediaElements(doc: Document): Promise<void> {
		const selectors: { tag: string; attr: string }[] = [
			{ tag: "img", attr: "src" },
			{ tag: "script", attr: "src" },
			{ tag: "audio", attr: "src" },
			{ tag: "video", attr: "src" },
			{ tag: "source", attr: "src" },
			{ tag: "track", attr: "src" },
			{ tag: "embed", attr: "src" },
		];

		for (const { tag, attr } of selectors) {
			for (const el of Array.from(doc.querySelectorAll(tag))) {
				const value = el.getAttribute(attr);
				if (!value) continue;

				const rewritten = await this.tryRewriteUrl(value);
				if (rewritten !== null) {
					el.setAttribute(attr, rewritten);
				} else if (!this.allowExternal && this.isExternalUrl(value)) {
					el.removeAttribute(attr);
				}
			}
		}
	}

	private async rewriteLinkElements(doc: Document): Promise<void> {
		for (const el of Array.from(doc.querySelectorAll("link"))) {
			const href = el.getAttribute("href");
			if (!href) continue;

			const rel = (el.getAttribute("rel") || "").toLowerCase();

			if (rel === "stylesheet") continue;

			const rewritten = await this.tryRewriteUrl(href);
			if (rewritten !== null) {
				el.setAttribute("href", rewritten);
			} else if (!this.allowExternal && this.isExternalUrl(href)) {
				el.remove();
			}
		}
	}

	private async inlineStylesheets(doc: Document): Promise<void> {
		const links = Array.from(doc.querySelectorAll('link[rel="stylesheet"]'));

		for (const link of links) {
			const href = link.getAttribute("href");
			if (!href) continue;

			let cssContent: string | null = null;
			let basePath: string;

			if (this.isAbsoluteUrl(href)) {
				if (!this.allowExternal) continue;
				try {
					const res = await requestUrl(href);
					cssContent = res.text;
				} catch {
					// Ignore fetch errors.
				}
				basePath = "";
			} else {
				const resolvedPath = this.resolveVaultPath(href);
				const file = this.app.vault.getAbstractFileByPath(resolvedPath);
				if (file instanceof TFile) {
					cssContent = await this.app.vault.cachedRead(file);
					basePath = file.parent?.path ?? "";
				} else {
					continue;
				}
			}

			if (cssContent !== null) {
				const styleEl = doc.createElement("style");
				styleEl.textContent = this.rewriteCssUrls(cssContent, basePath);
				link.parentNode?.insertBefore(styleEl, link);
				link.remove();
			}
		}
	}

	private rewriteInlineStyles(doc: Document): void {
		for (const styleEl of Array.from(doc.querySelectorAll("style"))) {
			const css = styleEl.textContent || "";
			const basePath = this.sourceFile.parent?.path ?? "";
			styleEl.textContent = this.rewriteCssUrls(css, basePath);
		}
	}

	private rewriteCssUrls(css: string, basePath: string): string {
		// Rewrite url(...)
		css = css.replace(/url\(\s*['"]?([^'"()\s]+)['"]?\s*\)/g, (match: string, url: string): string => {
			if (this.isAbsoluteUrl(url)) {
				if (!this.allowExternal && this.isExternalUrl(url)) {
					return 'url("data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7")';
				}
				return match;
			}
			const resolvedPath = this.resolveVaultPath(url, basePath);
			const file = this.app.vault.getAbstractFileByPath(resolvedPath);
			if (file instanceof TFile) {
				return `url("${this.app.vault.getResourcePath(file)}")`;
			}
			return match;
		});

		// Rewrite @import "..." and @import url("...")
		css = css.replace(/@import\s+(?:url\(\s*['"]?([^'"()\s]+)['"]?\s*\)|['"]([^'"]+)['"])\s*;?/g, (match: string, url1: string | undefined, url2: string | undefined): string => {
			const url = url1 || url2;
			if (!url) return match;
			if (this.isAbsoluteUrl(url)) {
				if (!this.allowExternal && this.isExternalUrl(url)) {
					return "/* @import blocked */";
				}
				return match;
			}
			const resolvedPath = this.resolveVaultPath(url, basePath);
			const file = this.app.vault.getAbstractFileByPath(resolvedPath);
			if (file instanceof TFile) {
				return `@import "${this.app.vault.getResourcePath(file)}";`;
			}
			return match;
		});

		return css;
	}

	private async tryRewriteUrl(url: string): Promise<string | null> {
		if (this.isAbsoluteUrl(url)) return null;
		const resolvedPath = this.resolveVaultPath(url);
		const file = this.app.vault.getAbstractFileByPath(resolvedPath);
		if (file instanceof TFile) {
			return this.app.vault.getResourcePath(file);
		}
		return null;
	}

	private resolveVaultPath(rawUrl: string, basePath?: string): string {
		const dir = basePath ?? (this.sourceFile.parent?.path ?? "");
		const combined = dir ? `${dir}/${rawUrl}` : rawUrl;
		return this.normalizePath(combined);
	}

	private normalizePath(path: string): string {
		const parts = path.split("/");
		const stack: string[] = [];
		for (const part of parts) {
			if (part === "..") {
				stack.pop();
			} else if (part !== "." && part !== "") {
				stack.push(part);
			}
		}
		return stack.join("/");
	}

	private isAbsoluteUrl(url: string): boolean {
		return /^([a-z][a-z0-9+.-]*:|\/\/)/i.test(url.trim());
	}

	private isExternalUrl(url: string): boolean {
		return /^(https?:|\/\/)/i.test(url.trim());
	}

	private serializeDocument(doc: Document, original: string): string {
		const doctype = original.match(/<!DOCTYPE[^>]*>/i)?.[0] || "";
		return doctype + doc.documentElement.outerHTML;
	}
}
