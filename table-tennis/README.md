# 卓球

スマートフォンを主対象とし、PCブラウザでも遊べる1人用3D卓球ゲームです。PWAに対応しており、ホーム画面へ追加するとアプリのように起動できます。

## 遊び方

### サーブ

プレイヤーのサーブ時は、画面下部から種類を選び、台上をタップまたは左右にフリックしてサーブします。

- 上回転
- 下回転
- 横左
- 横右
- ナックル

選択した種類は同じページを開いている間、ポイントや再試合をまたいで保持されます。

### ラリー

- スマートフォン: 画面をドラッグしてラケットを操作します。
- PC: マウスをドラッグしてラケットを操作します。
- 上フリック: ドライブ。高い球を強く振るとスマッシュ。
- 下フリック: ツッツキ。
- 指やマウスを置くだけ: 押し出し。
- 設定ボタン: 一時停止、効果音、振動。

## 開発環境

Node.js 24とnpmを使用します。初回のみ依存関係とテスト用ブラウザを導入してください。

```powershell
npm ci
npx playwright install chromium webkit
```

開発サーバーを起動します。

```powershell
npm run dev
```

その後、`http://localhost:3038/` を開きます。同一ネットワーク内のスマートフォンからは、PCのIPアドレスを使って確認できます。

## 検証

```powershell
# ESLint、TypeScript、PWA構成、build、dist、単体、ブラウザテスト
npm run check

# 個別実行
npm run lint
npm run typecheck
npm run check:app
npm run build
npm run check:dist
npm run test:unit
npm run test:e2e
```

ブラウザテストは次の3環境で実行します。

- デスクトップ版Chromium
- Android相当Chromium
- iPhone相当WebKit

## ビルドとプレビュー

```powershell
npm run build
npm run preview
```

ビルド出力は `dist/` です。アプリ本体はService Workerの事前キャッシュ対象となる固定名で出力します。

- `dist/assets/app.js`
- `dist/assets/app.css`

manifest、Service Worker、`.nojekyll`、iconsも `dist/` へコピーされます。

## GitHub Pages

`master`へのtable-tennis関連push時に、`.github/workflows/deploy-table-tennis-pages.yml` が次を行います。

1. Node.js 24と依存関係を準備。
2. PlaywrightのChromiumとWebKitを準備。
3. `npm run check` を実行。
4. 成功した `table-tennis/dist/` だけをPages artifactとしてアップロード。
5. GitHub Pagesへデプロイ。

Pull Requestでは `.github/workflows/test-table-tennis.yml` が同じ全検証を行います。公開URLは次です。

<https://sitar-sitar.github.io/sitar/>

## ファイル構成

```text
.
├── index.html
├── src/
│   ├── main.ts
│   ├── game.ts
│   ├── physics.ts
│   ├── rules.ts
│   ├── input.ts
│   ├── render.ts
│   ├── ui.ts
│   ├── feedback.ts
│   ├── config.ts
│   ├── types.ts
│   └── styles.css
├── manifest.webmanifest
├── sw.js
├── package.json
├── tsconfig.json
├── vite.config.js
├── playwright.config.js
├── eslint.config.js
├── scripts/
│   ├── check-app.mjs
│   └── check-dist.mjs
├── tests/
│   ├── app-contract.test.mjs
│   ├── game-core.test.ts
│   └── game-smoke.spec.js
├── icons/
└── docs/
```
