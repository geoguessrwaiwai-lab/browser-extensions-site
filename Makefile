SHELL := /bin/sh

DIST_DIR := dist
SITE_DIR := $(DIST_DIR)/site
SITE_PACKAGE := $(DIST_DIR)/browser-extensions-site.zip
PUBLIC_ENTRIES := index.html en sitemap.xml reset.css styles.css favicon.png _redirects assets geoguessr-ctrl-enter map-making-app-tools

.PHONY: validate cloudflare-build package site-package clean

# 必須ファイル、内部リンク、JavaScript、メディア形式を検証する。
validate:
	@node scripts/validate.mjs

# Cloudflare Workersへデプロイする静的ファイルだけを出力する。
cloudflare-build: validate
	@rm -rf "$(SITE_DIR)"
	@mkdir -p "$(SITE_DIR)"
	@cp -R $(PUBLIC_ENTRIES) "$(SITE_DIR)/"
	@echo "Created: $(SITE_DIR)"

# Cloudflareへ手動アップロードできるZIPを作成する。
package: cloudflare-build
	@mkdir -p "$(DIST_DIR)"
	@rm -f "$(SITE_PACKAGE)"
	@cd "$(SITE_DIR)" && zip -r -q "../browser-extensions-site.zip" . -x '*.DS_Store' '*.mov'
	@echo "Created: $(SITE_PACKAGE)"

# 既存サイトリポジトリで使っていたコマンド名も利用できるようにする。
site-package: package

clean:
	@rm -rf "$(SITE_DIR)"
	@rm -f "$(SITE_PACKAGE)"
