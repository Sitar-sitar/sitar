# 卓球

スマートフォンとPCのブラウザで遊べる、1ファイル構成の3D卓球ゲームです。
PWAに対応しており、ホーム画面へ追加するとアプリのように起動できます。

## 遊び方

- スマートフォン: 画面をドラッグしてラケットを操作します。
- PC: マウスを動かしてラケットを操作します。
- 設定ボタンから難易度や効果音を変更できます。

## 開発環境

Node.js 24とnpmを使用します。初回のみ依存関係とテスト用ブラウザを導入してください。

```sh
npm ci
npx playwright install chromium webkit
```

開発サーバーを起動します。

```sh
npm run dev
```

その後、`http://localhost:3038/` を開きます。同一ネットワーク内のスマートフォンからは、PCのIPアドレスを使って確認できます。

## 検証

```sh
# ESLint、アプリ構成検査、ビルド、単体テスト、ブラウザテスト
npm run check

# 個別実行
npm run lint
npm run check:app
npm run build
npm run test:unit
npm run test:e2e
```

ブラウザテストはデスクトップ版ChromiumとiPhone相当のWebKitで実行されます。Pull Requestと`master`へのpush時にもGitHub Actionsで同じ検証を行います。

`npm run build`の出力先は`dist/`です。既存のGitHub Pages配布設定は引き続きソースの`table-tennis/`を公開するため、今回の開発環境追加によって公開手順は変わりません。

## GitHub Pages

このリポジトリはGitHub Pagesでそのまま公開できる構成です。
公開元は既定ブランチのルートディレクトリを指定してください。

## ファイル構成

```text
.
├── index.html
├── manifest.webmanifest
├── sw.js
├── package.json
├── vite.config.js
├── playwright.config.js
├── eslint.config.js
├── scripts/
│   └── check-app.mjs
├── tests/
│   ├── app-contract.test.mjs
│   └── game-smoke.spec.js
├── icons/
│   ├── apple-touch-icon.png
│   ├── icon-192.png
│   ├── icon-512.png
│   └── icon-maskable-512.png
└── README.md
```
