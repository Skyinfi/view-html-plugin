import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const htmlViewSource = await readFile(new URL("../src/html-view.ts", import.meta.url), "utf8");
const resourceRewriterSource = await readFile(new URL("../src/resource-rewriter.ts", import.meta.url), "utf8");

test("iframe sandbox is assigned without adding an empty token", () => {
	assert.equal(htmlViewSource.includes(".sandbox.add(\"\")"), false);
	assert.match(htmlViewSource, /setAttribute\("sandbox"/);
});

test("CSP follows form, external resource, and JavaScript settings", () => {
	assert.match(htmlViewSource, /allowForms/);
	assert.match(htmlViewSource, /const formActionSources = allowForms \? "http: https:" : "'none'"/);
	assert.match(htmlViewSource, /const connectSources = allowExternal \? "http: https:" : "'none'"/);
	assert.match(htmlViewSource, /"app: blob: data: http: https: 'unsafe-inline'"/);
	assert.match(htmlViewSource, /`form-action \$\{formActionSources\};`/);
});

test("relative CSS urls trigger local resource mode", () => {
	assert.match(htmlViewSource, /url\\\(/);
	assert.match(htmlViewSource, /@import/);
});

test("stylesheets are inlined before generic link rewriting", () => {
	const inlineIndex = resourceRewriterSource.indexOf("await this.inlineStylesheets(doc);");
	const linkIndex = resourceRewriterSource.indexOf("await this.rewriteLinkElements(doc);");

	assert.ok(inlineIndex >= 0, "inlineStylesheets call is missing");
	assert.ok(linkIndex >= 0, "rewriteLinkElements call is missing");
	assert.ok(inlineIndex < linkIndex, "stylesheets must be inlined before link elements are rewritten");
	assert.equal(resourceRewriterSource.includes("Stylesheets are inlined separately; remove the link."), false);
});
