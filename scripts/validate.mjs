import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";

const SITE_ROOT = process.cwd();
const REQUIRED_FILES = [
  "index.html",
  "en/index.html",
  "sitemap.xml",
  "reset.css",
  "styles.css",
  "favicon.png",
  "_redirects",
  "assets/geoguessr-emblem.svg",
  "assets/Discord-Symbol-White.svg",
  "assets/user-icon-42.webp",
  "assets/user-icon-48.webp",
  "assets/ctrl-enter-card-poster.webp",
  "assets/map-tools-card-poster.webp",
  "assets/user-icon.webp",
  "assets/user-icon-2.webp",
  "README.md",
  "wrangler.jsonc",
  "AGENTS.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "LICENSE",
  "docs/MAINTAINING.md",
  "geoguessr-ctrl-enter/index.html",
  "geoguessr-ctrl-enter/privacy/index.html",
  "geoguessr-ctrl-enter/contact/index.html",
  "geoguessr-ctrl-enter/en/index.html",
  "geoguessr-ctrl-enter/en/privacy/index.html",
  "geoguessr-ctrl-enter/en/contact/index.html",
  "geoguessr-ctrl-enter/styles.css",
  "geoguessr-ctrl-enter/comparison.js",
  "geoguessr-ctrl-enter/favicon.png",
  "geoguessr-ctrl-enter/assets/before.mp4",
  "geoguessr-ctrl-enter/assets/after.mp4",
  "map-making-app-tools/index.html",
  "map-making-app-tools/privacy/index.html",
  "map-making-app-tools/contact/index.html",
  "map-making-app-tools/en/index.html",
  "map-making-app-tools/en/privacy/index.html",
  "map-making-app-tools/en/contact/index.html",
  "map-making-app-tools/styles.css",
  "map-making-app-tools/favicon.png",
  "map-making-app-tools/assets/resizable-editor-demo.mp4",
  "map-making-app-tools/assets/resizable-editor-demo-poster.jpg",
  "map-making-app-tools/assets/folder-view.png",
  "map-making-app-tools/assets/settings.png",
  "map-making-app-tools/assets/settings-folder-view.png"
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const file of REQUIRED_FILES) {
  assert(fs.existsSync(file), `Missing required file: ${file}`);
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === ".git" || entry.name === "dist" ? [] : walk(target);
    }
    return [target];
  });
}

const htmlFiles = walk(SITE_ROOT).filter((file) => file.endsWith(".html"));
const localReferencePattern = /(?:href|src|poster)="(\/[^"]*)"/g;
const GTM_CONTAINER_ID = "GTM-NR3K4XBC";
const GTM_HEAD_MARKER = "<!-- Google Tag Manager -->";
const GTM_BODY_MARKER = "<!-- Google Tag Manager (noscript) -->";
const SITE_ORIGIN = "https://app.geoguessr-waiwai.workers.dev";

assert(htmlFiles.length === 14, "all 14 site pages must be present");

const wranglerConfig = JSON.parse(fs.readFileSync("wrangler.jsonc", "utf8"));
assert(wranglerConfig.name === "app", "Wrangler must deploy to the existing app Worker");
assert(wranglerConfig.assets?.directory === "./dist/site", "Wrangler must deploy the generated static site directory");

for (const htmlFile of htmlFiles) {
  const relativeHtmlPath = path.relative(SITE_ROOT, htmlFile);
  const html = fs.readFileSync(htmlFile, "utf8");
  assert(!/<script[^>]+src="https?:\/\//i.test(html), `${relativeHtmlPath} must not load remote scripts`);
  const resetIndex = html.indexOf('href="/reset.css"');
  const pageStylesIndex = html.lastIndexOf('rel="stylesheet"');
  assert(resetIndex !== -1, `${relativeHtmlPath} must load the shared reset.css`);
  assert(resetIndex < pageStylesIndex, `${relativeHtmlPath} must load reset.css before page styles`);
  assert(html.split(GTM_CONTAINER_ID).length - 1 === 2, `${relativeHtmlPath} must include both GTM snippets exactly once`);
  assert(html.split('rel="alternate"').length - 1 === 3, `${relativeHtmlPath} must include ja, en, and x-default alternate links`);
  assert(html.includes('hreflang="ja"'), `${relativeHtmlPath} must link to its Japanese version`);
  assert(html.includes('hreflang="en"'), `${relativeHtmlPath} must link to its English version`);
  assert(html.includes('hreflang="x-default"'), `${relativeHtmlPath} must declare its Japanese version as x-default`);
  const publicPath = `/${relativeHtmlPath.replace(/index\.html$/, "")}`;
  const canonicalUrl = `${SITE_ORIGIN}${publicPath}`;
  assert(html.split('rel="canonical"').length - 1 === 1, `${relativeHtmlPath} must include exactly one canonical link`);
  assert(html.includes(`<link rel="canonical" href="${canonicalUrl}">`), `${relativeHtmlPath} must use its absolute self-referencing canonical URL`);

  const headIndex = html.indexOf("<head>");
  const gtmHeadIndex = html.indexOf(GTM_HEAD_MARKER);
  const firstMetaIndex = html.indexOf("<meta");
  assert(headIndex < gtmHeadIndex && gtmHeadIndex < firstMetaIndex, `${relativeHtmlPath} must place GTM at the top of head`);
  assert(
    /<body>\s*<!-- Google Tag Manager \(noscript\) -->/.test(html),
    `${relativeHtmlPath} must place the GTM noscript block immediately after body`
  );
  assert(
    html.includes('https://www.googletagmanager.com/ns.html?id=GTM-NR3K4XBC'),
    `${relativeHtmlPath} must use the expected GTM noscript URL`
  );
  assert(
    html.includes("https://www.googletagmanager.com/gtm.js?id="),
    `${relativeHtmlPath} must use the expected GTM script URL`
  );
  assert(gtmHeadIndex !== -1 && html.includes(GTM_BODY_MARKER), `${relativeHtmlPath} must retain GTM markers`);

  const inlineScripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert(inlineScripts.length === 1, `${relativeHtmlPath} must contain exactly one inline GTM script`);
  new vm.Script(inlineScripts[0][1], { filename: `${relativeHtmlPath}:gtm` });

  for (const match of html.matchAll(localReferencePattern)) {
    const reference = match[1].split(/[?#]/, 1)[0];
    let target = path.join(SITE_ROOT, reference.slice(1));
    if (reference.endsWith("/")) target = path.join(target, "index.html");
    assert(fs.existsSync(target), `${relativeHtmlPath} has a broken local reference: ${reference}`);
  }
}

const localizedPagePairs = [
  ["index.html", "en/index.html"],
  ["geoguessr-ctrl-enter/index.html", "geoguessr-ctrl-enter/en/index.html"],
  ["geoguessr-ctrl-enter/privacy/index.html", "geoguessr-ctrl-enter/en/privacy/index.html"],
  ["geoguessr-ctrl-enter/contact/index.html", "geoguessr-ctrl-enter/en/contact/index.html"],
  ["map-making-app-tools/index.html", "map-making-app-tools/en/index.html"],
  ["map-making-app-tools/privacy/index.html", "map-making-app-tools/en/privacy/index.html"],
  ["map-making-app-tools/contact/index.html", "map-making-app-tools/en/contact/index.html"]
];

for (const [japaneseFile, englishFile] of localizedPagePairs) {
  const japanesePath = `/${japaneseFile.replace(/index\.html$/, "")}`;
  const englishPath = `/${englishFile.replace(/index\.html$/, "")}`;
  for (const file of [japaneseFile, englishFile]) {
    const html = fs.readFileSync(file, "utf8");
    assert(html.includes(`<link rel="alternate" hreflang="ja" href="${SITE_ORIGIN}${japanesePath}">`), `${file} must link to the matching Japanese page with an absolute URL`);
    assert(html.includes(`<link rel="alternate" hreflang="en" href="${SITE_ORIGIN}${englishPath}">`), `${file} must link to the matching English page with an absolute URL`);
    assert(html.includes(`<link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}${japanesePath}">`), `${file} must use Japanese as x-default with an absolute URL`);
  }
}

const sitemap = fs.readFileSync("sitemap.xml", "utf8");
assert(sitemap.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), "sitemap must declare UTF-8 XML");
assert(sitemap.includes('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'), "sitemap must use the sitemap namespace");
const sitemapLocations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
const canonicalUrls = htmlFiles.map((file) => {
  const relativePath = path.relative(SITE_ROOT, file);
  return `${SITE_ORIGIN}/${relativePath.replace(/index\.html$/, "")}`;
}).sort();
assert(sitemapLocations.length === 14, "sitemap must contain all 14 canonical pages");
assert(JSON.stringify([...sitemapLocations].sort()) === JSON.stringify(canonicalUrls), "sitemap URLs must match every canonical page exactly");
assert(!sitemap.includes("xhtml:"), "sitemap must use simple url and loc entries only");

const rootHtml = fs.readFileSync("index.html", "utf8");
const englishRootHtml = fs.readFileSync("en/index.html", "utf8");
assert(rootHtml.includes('href="/geoguessr-ctrl-enter/"'), "root must link to GeoGuessr Ctrl+Enter Chat");
assert(rootHtml.includes('href="/map-making-app-tools/"'), "root must link to Map Making App Tools");
assert(englishRootHtml.includes('href="/geoguessr-ctrl-enter/en/"'), "English root must link to English GeoGuessr Ctrl+Enter Chat");
assert(englishRootHtml.includes('href="/map-making-app-tools/en/"'), "English root must link to English Map Making App Tools");
const extensionCardLinks = [...rootHtml.matchAll(/<a class="extension-card [^>]+>([\s\S]*?)<\/a>/g)];
assert(extensionCardLinks.length === 2, "both extension cards must be links");
assert(extensionCardLinks.every((match) => !/<a\b/.test(match[1])), "extension cards must not contain nested links");
assert(
  rootHtml.includes('href="https://www.geoguessr.com/user/621f7436f0bf520001066b61"'),
  "root header must link to the GeoGuessr profile"
);
assert(rootHtml.includes('href="https://x.com/geo_waiwai"'), "root header must link to the X profile");
assert(rootHtml.includes('href="https://github.com/geoguessrwaiwai-lab"'), "root header must link to the GitHub account");
assert(rootHtml.includes('href="https://discordapp.com/users/1530473272674877450"'), "root header must link to the Discord profile");
assert(rootHtml.split('class="account-link"').length - 1 === 4, "root header must contain four account icon links");
assert(rootHtml.split('target="_blank"').length - 1 === 4, "all root account links must open in a new tab");
assert(rootHtml.split('rel="noopener noreferrer"').length - 1 === 4, "all root account links must protect the opener");
assert(rootHtml.includes('src="/assets/geoguessr-emblem.svg"'), "root must use the supplied GeoGuessr emblem");
assert(rootHtml.includes('src="/assets/Discord-Symbol-White.svg"'), "root must use the supplied Discord symbol");
assert(rootHtml.split("<svg ").length - 1 === 2, "the X and GitHub account links must use SVG icons");
assert(rootHtml.includes('src="/assets/user-icon-48.webp"'), "root brand must use the supplied user icon");
assert(rootHtml.includes('src="/assets/user-icon-42.webp"'), "root brand must use the second supplied user icon as the avatar");
for (const html of [rootHtml, englishRootHtml]) {
  assert(/<a class="brand" href="[^"]+">/.test(html), "root brand must derive its accessible name from visible text");
  assert(html.includes('poster="/assets/ctrl-enter-card-poster.webp"'), "root must use the optimized Ctrl+Enter poster");
  assert(html.includes('poster="/assets/map-tools-card-poster.webp"'), "root must use the optimized Map Making App Tools poster");
  assert(
    html.includes('<link rel="preload" as="image" href="/assets/ctrl-enter-card-poster.webp" type="image/webp" fetchpriority="high">'),
    "root must preload the LCP poster with high priority"
  );
}
assert(rootHtml.includes("Chrome Extensions") && rootHtml.includes("powered by WaiWai"), "root must show the requested brand copy with correct spelling");
assert(rootHtml.includes('/geoguessr-ctrl-enter/assets/after.mp4'), "root must show the Ctrl+Enter demo video");
assert(rootHtml.includes('/map-making-app-tools/assets/resizable-editor-demo.mp4'), "root must show the Map Making App Tools demo video");
assert(rootHtml.includes('class="language-switcher"'), "root must show the language switcher");
assert(englishRootHtml.includes('class="language-switcher"'), "English root must show the language switcher");
assert(
  rootHtml.includes('name="google-site-verification" content="cW5iTMxhqX0iA4qkaGmjI2or_jbRSHRYNmD9PM8CvwY"'),
  "root must retain the Google site verification tag"
);

const ctrlEnterHtml = fs.readFileSync("geoguessr-ctrl-enter/index.html", "utf8");
const ctrlEnterEnglishHtml = fs.readFileSync("geoguessr-ctrl-enter/en/index.html", "utf8");
const ctrlEnterPrivacyHtml = fs.readFileSync("geoguessr-ctrl-enter/privacy/index.html", "utf8");
const ctrlEnterEnglishPrivacyHtml = fs.readFileSync("geoguessr-ctrl-enter/en/privacy/index.html", "utf8");
const mapToolsHtml = fs.readFileSync("map-making-app-tools/index.html", "utf8");
const MAP_TOOLS_STORE_URL = "https://chromewebstore.google.com/detail/flhepjgbbcielemfkkkfimcfhgfomofj?utm_source=item-share-cb";
for (const sharedCopy of [
  "デモ動画",
  "インストール方法",
  "Chrome ウェブストアから、すぐにインストールできます。",
  "下のボタンからChrome ウェブストアを開きます。",
  "「Chromeに追加」を選びます。",
  "Chrome ウェブストアからインストール",
  "データを収集しません",
  "ソースコードを公開しています",
  "拡張機能の動作を確認できるよう、ソースコードをGitHubで公開しています。",
  "GitHubでソースコードを見る"
]) {
  assert(ctrlEnterHtml.includes(sharedCopy), `Ctrl+Enter page must include shared copy: ${sharedCopy}`);
  assert(mapToolsHtml.includes(sharedCopy), `Map Making App Tools page must include shared copy: ${sharedCopy}`);
}
assert(mapToolsHtml.includes(`<a class="button" href="${MAP_TOOLS_STORE_URL}" target="_blank" rel="noopener noreferrer">Chrome ウェブストアからインストール</a>`), "Map Making App Tools must open its published store listing safely in a new tab");
assert(ctrlEnterHtml.includes("chromewebstore.google.com/detail/lkemfhnkoiicmidagaajpcodidmjnbpm"), "Ctrl+Enter must retain its store link");
assert(ctrlEnterEnglishHtml.includes("chromewebstore.google.com/detail/lkemfhnkoiicmidagaajpcodidmjnbpm"), "English Ctrl+Enter must retain its store link");
for (const [name, html] of [
  ["Japanese Ctrl+Enter", ctrlEnterHtml],
  ["English Ctrl+Enter", ctrlEnterEnglishHtml]
]) {
  const externalButtons = html.match(/<a class="(?:header-install-button|button)" href="(?:https:\/\/chromewebstore\.google\.com\/detail\/lkemfhnkoiicmidagaajpcodidmjnbpm\?utm_source=item-share-cb|https:\/\/github\.com\/geoguessrwaiwai-lab\/geoguessr-ctrl-enter)"[^>]*>/g) ?? [];
  assert(externalButtons.length === 3, `${name} must retain its three external action buttons`);
  assert(externalButtons.every((link) => link.includes('target="_blank"') && link.includes('rel="noopener noreferrer"')), `${name} external action buttons must open safely in a new tab`);
}
assert(ctrlEnterEnglishHtml.includes('<h2 id="demo-title">Demo video</h2>'), "English Ctrl+Enter page must use the matching demo heading");
assert(ctrlEnterHtml.includes('<p class="eyebrow">VERSION 1.0.3</p>'), "Ctrl+Enter page must identify the 1.0.3 fast-move update");
assert(ctrlEnterHtml.includes("Movingモードの高速移動も快適に"), "Ctrl+Enter page must describe Moving fast travel");
assert(ctrlEnterHtml.includes("移動矢印にフォーカスせずSpaceを押した場合は、従来どおり確定できます。"), "Ctrl+Enter page must preserve normal Space guess submission");
assert(ctrlEnterEnglishHtml.includes('<p class="eyebrow">VERSION 1.0.3</p>'), "English Ctrl+Enter page must identify the 1.0.3 fast-move update");
assert(ctrlEnterEnglishHtml.includes("Better fast travel in Moving mode"), "English Ctrl+Enter page must describe Moving fast travel");
assert(ctrlEnterEnglishHtml.includes("Space still submits normally when a movement arrow was not focused"), "English Ctrl+Enter page must preserve normal Space guess submission");
assert(rootHtml.includes("MovingのEnter・Space高速移動にも対応します。"), "root Ctrl+Enter card must mention Moving fast travel");
assert(englishRootHtml.includes("improve Enter and Space fast travel in Moving mode"), "English root Ctrl+Enter card must mention Moving fast travel");
assert(ctrlEnterPrivacyHtml.includes("Enter、\n        Space、Control+Enter"), "Ctrl+Enter privacy policy must disclose Space key processing");
assert(ctrlEnterPrivacyHtml.includes("最終更新日: 2026年8月8日"), "Ctrl+Enter privacy policy must use the 1.0.3 update date");
assert(ctrlEnterEnglishPrivacyHtml.includes("Enter, Space,"), "English Ctrl+Enter privacy policy must disclose Space key processing");
assert(ctrlEnterEnglishPrivacyHtml.includes("Last updated: August 8, 2026"), "English Ctrl+Enter privacy policy must use the 1.0.3 update date");

for (const [name, html] of [
  ["Ctrl+Enter", ctrlEnterHtml],
  ["Map Making App Tools", mapToolsHtml]
]) {
  const header = html.match(/<header class="site-header">([\s\S]*?)<\/header>/)?.[1] ?? "";
  const expectedInstallHref = name === "Map Making App Tools" ? MAP_TOOLS_STORE_URL : "https://chromewebstore.google.com/detail/lkemfhnkoiicmidagaajpcodidmjnbpm?utm_source=item-share-cb";
  const expectedInstallAttributes = ' target="_blank" rel="noopener noreferrer"';
  assert(header.includes(`class="header-install-button" href="${expectedInstallHref}"${expectedInstallAttributes}>インストール</a>`), `${name} header must use the shared install action`);
  assert(html.includes('<section class="demo-section" aria-labelledby="demo-title">'), `${name} must use the shared demo section structure`);
  assert(html.includes('<h2 id="demo-title">デモ動画</h2>'), `${name} must use the shared demo heading`);
  assert(!html.includes('class="hero"'), `${name} must remove the product hero`);
  assert(/<main>\s*<section class="demo-section"/.test(html), `${name} must show the demo first`);
  assert(!html.includes('id="features-title"'), `${name} must remove the features heading`);
  assert(!html.includes('class="cards"'), `${name} must remove the numbered feature cards`);
}

const mapToolsEnglishHtml = fs.readFileSync("map-making-app-tools/en/index.html", "utf8");
assert(mapToolsEnglishHtml.includes(`<a class="button" href="${MAP_TOOLS_STORE_URL}" target="_blank" rel="noopener noreferrer">Install from the Chrome Web Store</a>`), "English Map Making App Tools must open its published store listing safely in a new tab");
for (const [name, html] of [
  ["Japanese Map Making App Tools", mapToolsHtml],
  ["English Map Making App Tools", mapToolsEnglishHtml]
]) {
  const externalButtons = html.match(/<a class="(?:header-install-button|button)" href="(?:https:\/\/chromewebstore\.google\.com\/detail\/flhepjgbbcielemfkkkfimcfhgfomofj\?utm_source=item-share-cb|https:\/\/github\.com\/geoguessrwaiwai-lab\/map-making-app-tools)"[^>]*>/g) ?? [];
  assert(externalButtons.length === 3, `${name} must retain its three external action buttons`);
  assert(externalButtons.every((link) => link.includes('target="_blank"') && link.includes('rel="noopener noreferrer"')), `${name} external action buttons must open safely in a new tab`);
}
assert(mapToolsEnglishHtml.includes('<h2 id="demo-title">Demo video</h2>'), "English Map Making App Tools page must use the matching demo heading");
assert(!mapToolsHtml.includes('class="range-card"'), "Map Making App Tools must not show the width range card");
assert(!mapToolsEnglishHtml.includes('class="range-card"'), "English Map Making App Tools must not show the width range card");
assert((mapToolsHtml.match(/class="demo-feature"/g) ?? []).length === 3, "Map Making App Tools must show its three published features");
assert((mapToolsEnglishHtml.match(/class="demo-feature"/g) ?? []).length === 3, "English Map Making App Tools must show its three published features");
assert((mapToolsHtml.match(/resizable-editor-demo\.mp4/g) ?? []).length === 1, "screen width adjustment must keep its dedicated demo");
assert((mapToolsHtml.match(/pochipochi-mode-demo\.mp4/g) ?? []).length === 1, "Pochi-pochi mode must use the converted sample-2 demo");
assert((mapToolsHtml.match(/assets\/folder-view\.png/g) ?? []).length === 1, "folder view must keep its dedicated screenshot");
assert((mapToolsEnglishHtml.match(/assets\/folder-view\.png/g) ?? []).length === 1, "English folder view must keep its dedicated screenshot");
assert((mapToolsHtml.match(/assets\/settings-folder-view\.png/g) ?? []).length === 1, "folder view settings must keep their dedicated screenshot");
assert((mapToolsEnglishHtml.match(/assets\/settings-folder-view\.png/g) ?? []).length === 1, "English folder view settings must keep their dedicated screenshot");
assert(!mapToolsHtml.includes("タグのグループ化"), "Map Making App Tools must not advertise unpublished tag grouping");
assert(!mapToolsEnglishHtml.includes("Tag groups"), "English Map Making App Tools must not advertise unpublished tag grouping");
assert(/id="demo-title">デモ動画<\/h2>[\s\S]*?class="shortcuts"[\s\S]*?class="comparison-grid"/.test(ctrlEnterHtml), "Ctrl+Enter shortcuts must appear below the demo heading and above the videos");
assert(/id="demo-title">Demo video<\/h2>[\s\S]*?class="shortcuts"[\s\S]*?class="comparison-grid"/.test(ctrlEnterEnglishHtml), "English Ctrl+Enter shortcuts must appear below the demo heading and above the videos");
assert(ctrlEnterHtml.includes("GeoGuessrの対戦中チャットで、Enter単体による送信を防ぎます。"), "Ctrl+Enter demo must include the requested explanation");
assert(!ctrlEnterHtml.includes("日本語の変換中に誤送信する場合と、拡張機能で防ぐ場合を比較できます。"), "Ctrl+Enter demo must remove the old comparison explanation");
assert(!mapToolsHtml.includes("2つの機能を動画で確認できます。"), "Map Making App Tools must remove the redundant demo introduction");
assert(mapToolsHtml.includes("あなたのマップを汚さずに &quot;ぽちぽち&quot; できます。") || mapToolsHtml.includes('あなたのマップを汚さずに "ぽちぽち" できます。'), "Map Making App Tools must include the requested Pochi-pochi explanation");
assert(mapToolsHtml.includes("data-copy-chrome-url"), "Map Making App Tools must show a copy control for chrome://extensions/");
assert(mapToolsEnglishHtml.includes("data-copy-chrome-url"), "English Map Making App Tools must show a copy control for chrome://extensions/");
assert(/id="settings-title">機能ごとに設定できます<\/h2>\s*<figure class="settings-preview">/.test(mapToolsHtml), "Map Making App Tools must show settings.png directly below the settings heading");
assert(/id="settings-title">Configure each feature<\/h2>\s*<figure class="settings-preview">/.test(mapToolsEnglishHtml), "English Map Making App Tools must show settings.png directly below the settings heading");

const redirects = fs.readFileSync("_redirects", "utf8");
assert(redirects.includes("/privacy/ /geoguessr-ctrl-enter/privacy/  301"), "legacy privacy URL must redirect to Ctrl+Enter privacy");
assert(redirects.includes("/contact/ /geoguessr-ctrl-enter/contact/  301"), "legacy contact URL must redirect to Ctrl+Enter contact");

for (const htmlFile of htmlFiles.filter((file) => file.includes("/geoguessr-ctrl-enter/"))) {
  const html = fs.readFileSync(htmlFile, "utf8");
  const header = html.match(/<header class="site-header">([\s\S]*?)<\/header>/)?.[1] ?? "";
  assert(!/(?:href|src|poster)="\/(?!"|en\/|reset\.css"|geoguessr-ctrl-enter\/)/.test(html), `${path.relative(SITE_ROOT, htmlFile)} must keep local references under /geoguessr-ctrl-enter/`);
  assert(header.includes('class="header-actions"'), `${path.relative(SITE_ROOT, htmlFile)} must use the shared header structure`);
  assert(header.includes('class="header-install-button"'), `${path.relative(SITE_ROOT, htmlFile)} must show the install action in the header`);
  assert(header.includes('href="https://chromewebstore.google.com/detail/lkemfhnkoiicmidagaajpcodidmjnbpm?utm_source=item-share-cb" target="_blank" rel="noopener noreferrer"'), `${path.relative(SITE_ROOT, htmlFile)} header install action must open the Chrome Web Store safely in a new tab`);
  assert(!header.includes("github"), `${path.relative(SITE_ROOT, htmlFile)} must not link to GitHub from the header`);
  const isEnglish = htmlFile.includes("/en/");
  const footerHref = isEnglish ? "/en/" : "/";
  const footerLabel = isEnglish ? "Explore other extensions" : "他の拡張機能も見る";
  assert(new RegExp(`<footer>[\\s\\S]*?<a href="${footerHref}">${footerLabel}</a>[\\s\\S]*?</footer>`).test(html), `${path.relative(SITE_ROOT, htmlFile)} must link to other extensions from the footer`);
  assert(header.includes('class="language-switcher"'), `${path.relative(SITE_ROOT, htmlFile)} must show the language switcher`);
}

for (const htmlFile of htmlFiles.filter((file) => file.includes("/map-making-app-tools/"))) {
  const html = fs.readFileSync(htmlFile, "utf8");
  const header = html.match(/<header class="site-header">([\s\S]*?)<\/header>/)?.[1] ?? "";
  assert(!/(?:href|src|poster)="\/(?!"|en\/|reset\.css"|map-making-app-tools\/)/.test(html), `${path.relative(SITE_ROOT, htmlFile)} must keep local references under /map-making-app-tools/`);
  assert(header.includes('class="header-actions"'), `${path.relative(SITE_ROOT, htmlFile)} must use the shared header structure`);
  assert(header.includes('class="header-install-button"'), `${path.relative(SITE_ROOT, htmlFile)} must show the install action in the header`);
  assert(header.includes(`href="${MAP_TOOLS_STORE_URL}" target="_blank" rel="noopener noreferrer"`), `${path.relative(SITE_ROOT, htmlFile)} must open the published store listing safely in a new tab`);
  assert(!header.includes("github"), `${path.relative(SITE_ROOT, htmlFile)} must not link to GitHub from the header`);
  assert(!header.includes("導入する"), `${path.relative(SITE_ROOT, htmlFile)} must label the header action as install`);
  assert(!header.includes("<img"), `${path.relative(SITE_ROOT, htmlFile)} must keep the product header text-only`);
  const isEnglish = htmlFile.includes("/en/");
  const footerHref = isEnglish ? "/en/" : "/";
  const footerLabel = isEnglish ? "Explore other extensions" : "他の拡張機能も見る";
  assert(new RegExp(`<footer>[\\s\\S]*?<a href="${footerHref}">${footerLabel}</a>[\\s\\S]*?</footer>`).test(html), `${path.relative(SITE_ROOT, htmlFile)} must link to other extensions from the footer`);
}

const geoguessrEmblem = fs.readFileSync("assets/geoguessr-emblem.svg");
assert(
  crypto.createHash("sha256").update(geoguessrEmblem).digest("hex") === "4deed1bfe069b458c4a7c46c6d84a77cac160c1076c192818f3e7aa36e90ebd0",
  "the supplied GeoGuessr emblem must remain unchanged"
);
const userIcon = fs.readFileSync("assets/user-icon.webp");
assert(
  crypto.createHash("sha256").update(userIcon).digest("hex") === "42bf450336e0b706eeb59e091a51f5b944871ef489fb2d44336aa581ac1b4e42",
  "the supplied user icon must remain unchanged"
);
const userIconOverlay = fs.readFileSync("assets/user-icon-2.webp");
assert(
  crypto.createHash("sha256").update(userIconOverlay).digest("hex") === "b29b7e473b5eefb442512f798c97d5942d1420bfe4e16fffd8e40cadfca68eb4",
  "the supplied second user icon must remain unchanged"
);
const ctrlEnterFavicon = fs.readFileSync("geoguessr-ctrl-enter/favicon.png");
assert(ctrlEnterFavicon[25] === 6, "Ctrl+Enter favicon must use RGBA PNG with transparent corners");

const ctrlStyles = fs.readFileSync("geoguessr-ctrl-enter/styles.css", "utf8");
const mapStyles = fs.readFileSync("map-making-app-tools/styles.css", "utf8");
const rootStyles = fs.readFileSync("styles.css", "utf8");
assert(/\.settings-preview\s*\{[^}]*max-width:\s*600px;[^}]*margin:\s*24px auto 28px;/s.test(mapStyles), "the settings screenshot must be centered at a maximum width of 600px");
assert(ctrlStyles.includes("width: min(1120px, calc(100% - 40px));"), "Ctrl+Enter must use the shared content width");
assert(mapStyles.includes("width: min(1120px, calc(100% - 40px));"), "Map Making App Tools must use the shared content width");
assert(/\.shortcuts\s*\{[^}]*width:\s*100%;/s.test(ctrlStyles), "the shortcut panel must use the full content width");
assert(/\.demo-feature-list\s*\{[^}]*display:\s*grid;[^}]*gap:\s*72px;/s.test(mapStyles), "Map Making App Tools demos must be separated vertically");
assert(
  /\.brand-icon-avatar\s*\{[^}]*width:\s*44%;[^}]*height:\s*44%;/s.test(rootStyles),
  "the avatar must retain the supplied 44% size balance"
);
const ctrlHeadingRule = ctrlStyles.match(/h2\s*\{([^}]+)\}/)?.[1].replace(/\s+/g, " ").trim();
const mapHeadingRule = mapStyles.match(/h2\s*\{([^}]+)\}/)?.[1].replace(/\s+/g, " ").trim();
assert(ctrlHeadingRule === mapHeadingRule, "both extension sites must use the same h2 rule");
assert(/h1\s*\{[^}]*line-height:\s*1\.1[;}]/.test(ctrlStyles), "Ctrl+Enter h1 must use the shared line height");
assert(/h1\s*\{[^}]*line-height:\s*1\.1[;}]/.test(mapStyles), "Map Making App Tools h1 must use the shared line height");

new vm.Script(fs.readFileSync("geoguessr-ctrl-enter/comparison.js", "utf8"), {
  filename: "geoguessr-ctrl-enter/comparison.js"
});
new vm.Script(fs.readFileSync("map-making-app-tools/copy.js", "utf8"), {
  filename: "map-making-app-tools/copy.js"
});

for (const mediaPath of [
  "geoguessr-ctrl-enter/assets/before.mp4",
  "geoguessr-ctrl-enter/assets/after.mp4",
  "map-making-app-tools/assets/resizable-editor-demo.mp4",
  "map-making-app-tools/assets/pochipochi-mode-demo.mp4"
]) {
  const media = fs.readFileSync(mediaPath);
  assert(media.subarray(4, 8).toString("ascii") === "ftyp", `${mediaPath} must use an MP4 container`);
}

for (const imagePath of [
  "geoguessr-ctrl-enter/assets/before-poster.jpg",
  "geoguessr-ctrl-enter/assets/after-poster.jpg",
  "map-making-app-tools/assets/resizable-editor-demo-poster.jpg",
  "map-making-app-tools/assets/pochipochi-mode-demo-poster.jpg"
]) {
  const image = fs.readFileSync(imagePath);
  assert(image[0] === 0xff && image[1] === 0xd8, `${imagePath} must be a JPEG image`);
}

for (const imagePath of [
  "assets/ctrl-enter-card-poster.webp",
  "assets/map-tools-card-poster.webp",
  "assets/user-icon-48.webp",
  "assets/user-icon-42.webp"
]) {
  const image = fs.readFileSync(imagePath);
  assert(image.subarray(0, 4).toString("ascii") === "RIFF", `${imagePath} must use a WebP container`);
  assert(image.subarray(8, 12).toString("ascii") === "WEBP", `${imagePath} must be a WebP image`);
}

console.log(`Validated ${htmlFiles.length} HTML pages and their local references.`);
