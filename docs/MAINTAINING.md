# メンテナンスガイド

## 更新方針

- ルートの一覧は、公開中の拡張機能と一致させる。
- 製品ページの説明とプライバシーポリシーは、対応する拡張機能リポジトリの実装と一致させる。
- 一覧と各製品ページの日本語版と英語版は同時に更新する。
- 全ページの自己参照canonical、相互hreflang、言語切替リンク、`sitemap.xml`を同期する。
- ルートのGoogle所有権確認メタタグを維持する。
- 全HTMLページでGoogle Tag Managerコンテナ`GTM-NR3K4XBC`の2つのスニペットを維持する。
- Google Tag Managerのタグ構成を変更する場合は、通信先と各プライバシーポリシーを確認する。

## 公開手順

1. 作業ブランチで`make clean cloudflare-build package`を実行する。
2. ローカルHTTPサーバーでルートと各アプリの主要ページを確認する。
3. Pull RequestのCIが成功したことを確認して`main`へマージする。
4. Cloudflare Workers Buildsが`make cloudflare-build`と`npx wrangler deploy`を実行し、本番デプロイに成功したことを確認する。
5. 公開後に次のURLと内部リンクを確認する。

Cloudflare Workers Buildsの設定値は次のとおりです。

```text
Production branch: main
Build command: make cloudflare-build
Deploy command: npx wrangler deploy
Root directory: 未指定
```

手動アップロードが必要な場合は、`make package`で生成した`dist/browser-extensions-site.zip`を使用します。

```text
https://app.geoguessr-waiwai.workers.dev/
https://app.geoguessr-waiwai.workers.dev/en/
https://app.geoguessr-waiwai.workers.dev/geoguessr-ctrl-enter/
https://app.geoguessr-waiwai.workers.dev/geoguessr-ctrl-enter/en/
https://app.geoguessr-waiwai.workers.dev/map-making-app-tools/
https://app.geoguessr-waiwai.workers.dev/map-making-app-tools/en/
https://app.geoguessr-waiwai.workers.dev/sitemap.xml
```

Chrome ウェブストアのホームページURLとプライバシーポリシーURLも、各アプリの新しいサブディレクトリへ変更します。
