# Browser Extensions Site

[`geoguessrwaiwai-lab`](https://github.com/geoguessrwaiwai-lab) が公開するChrome拡張機能の共通案内サイトです。ビルドツールやパッケージ依存のない静的サイトとして構成しています。全ページでGoogle Tag Managerコンテナ`GTM-NR3K4XBC`を読み込みます。

公開先: [https://app.geoguessr-waiwai.workers.dev/](https://app.geoguessr-waiwai.workers.dev/)

## 公開ページ

| パス | 内容 | ソースリポジトリ |
| --- | --- | --- |
| `/`, `/en/` | 拡張機能一覧（日英） | このリポジトリ |
| `/geoguessr-ctrl-enter/`, `/geoguessr-ctrl-enter/en/` | GeoGuessr Ctrl+Enter Chat（日英） | [`geoguessr-ctrl-enter`](https://github.com/geoguessrwaiwai-lab/geoguessr-ctrl-enter) |
| `/map-making-app-tools/`, `/map-making-app-tools/en/` | Map Making App Tools（日英） | [`map-making-app-tools`](https://github.com/geoguessrwaiwai-lab/map-making-app-tools) |

各ページには日本語版と英語版があり、日本語をデフォルトとしています。各アプリ配下には、機能説明、プライバシーポリシー、お問い合わせページと表示用素材が含まれます。全ページに自己参照canonicalと相互hreflangを設定し、`sitemap.xml`にも両言語のURLを掲載しています。

旧Ctrl+Enterサイトの`/privacy/`と`/contact/`は、Chrome ウェブストア側のURL更新が反映されるまで新しい製品配下へ恒久リダイレクトします。

## ディレクトリ構成

```text
browser-extensions-site/
├── index.html                    # 拡張機能一覧
├── en/                           # 拡張機能一覧の英語版
├── sitemap.xml                   # 日英全ページのサイトマップ
├── reset.css                    # 全ページ共通の最小リセット
├── styles.css                    # 一覧ページのスタイル
├── favicon.png
├── _redirects                    # 旧Ctrl+EnterサイトURLからの移行
├── assets/                       # 共通ページで使用するアイコン・画像
├── geoguessr-ctrl-enter/         # Ctrl+Enterの案内サイト（日英）
│   └── en/                       # 英語版
├── map-making-app-tools/         # Map Making App Toolsの案内サイト
│   └── en/                       # 英語版
├── scripts/validate.mjs          # ページ構成と内部リンクの検証
├── docs/MAINTAINING.md           # 公開・更新手順
├── wrangler.jsonc                # Cloudflare Workersのデプロイ設定
├── Makefile
└── dist/                         # 生成物（Git管理対象外）
```

## ローカル確認

```bash
python3 -m http.server 8000
```

ブラウザで [http://localhost:8000](http://localhost:8000) を開きます。サブディレクトリを含むため、`index.html`を直接開かずHTTPサーバーを利用してください。

## 検証とパッケージ作成

Node.js、`make`、`zip`を使用します。依存関係のインストールは不要です。

```bash
make validate       # 必須ファイル、内部リンク、JavaScript、メディアを検証
make cloudflare-build # Workersへ公開するファイルをdist/siteへ生成
make package        # CloudflareへのDirect Upload用ZIPを生成
make site-package   # packageの別名
make clean          # 生成物を削除
```

生成物は`dist/browser-extensions-site.zip`です。

## Cloudflare Workersへの自動デプロイ

Cloudflare Workers Buildsでこのリポジトリを接続し、次のように設定します。

| 設定 | 値 |
| --- | --- |
| Production branch | `main` |
| Build command | `make cloudflare-build` |
| Deploy command | `npx wrangler deploy` |
| Root directory | 未指定（リポジトリのルート） |

`main`へ変更がマージされると、検証、静的ファイルの生成、Workersへのデプロイが順番に実行されます。`wrangler.jsonc`の`assets.directory`は、生成先の`./dist/site`を参照します。

## 関連リポジトリとの分担

このリポジトリは案内サイトだけを管理します。拡張機能の実装、Manifest、Chrome ウェブストア用パッケージ、ストア掲載画像は各拡張機能のリポジトリで管理します。機能やプライバシー上の挙動を変更した場合は、該当するソースリポジトリと本サイトの説明を同時に更新してください。Google Tag Managerは案内サイトだけで動作し、拡張機能本体には含まれません。

## ライセンス

このプロジェクトは[MIT License](LICENSE)で公開しています。
