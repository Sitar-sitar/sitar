# 卓球

スマートフォンを主対象とし、PCブラウザでも遊べる1人用3D卓球ゲームです。PWAに対応しており、ホーム画面へ追加するとアプリのように起動できます。v0.6.0では、9種類・3段階の長さのサーブに加えて、短い球への台上技術を追加しました。

## 遊び方

### サーブ

プレイヤーのサーブ時は、画面下部から種類と長さ（短い／中／長い）を選び、台上をタップまたは左右にフリックしてサーブします。

- 横上左
- 上回転
- 横上右
- 横左
- ナックル
- 横右
- 横下左
- 下回転
- 横下右

選択した種類と長さは同じページを開いている間、ポイントや再試合をまたいで保持されます。

### ラリー

- スマートフォン: 画面をドラッグしてラケットを操作します。
- PC: マウスをドラッグしてラケットを操作します。
- 上フリック: ドライブ。高い球を強く振るとスマッシュ。
- 下フリック: ツッツキ。
- 短い球: 下フリックでストップ、上フリックでフリック。
- 指やマウスを置くだけ: 押し出し。
- 設定ボタン: 一時停止、効果音、振動。

### ラケットの見え方

ラケットにはブレードと持ち手が描かれます。持ち手はスイングに合わせて傾き、スマッシュとツッツキでは逆向きに傾きます。相手のラケットも同じ形で、持ち手が腕の向きに合わせて描かれます。

打つ位置が台に近い（奥の）ときはラケットが小さく上に、手前のときは大きく下に描かれ、打点の前後が見た目でわかります。奥行きの移動は滑らかに変化し、ポイントの間は待機位置へ戻ります。ラケットの左右位置は打球判定と同じ基準で描かれるため、ボールと重なった位置で打てます。

## プレイヤーと戦績

タイトル画面の「プレイヤー」から、この端末で遊ぶ人を追加・選択・改名・削除できます。初回は `ゲスト` が自動作成されます。選択した名前はスコアボードへ反映され、決着した試合だけがそのプレイヤーの戦績として保存されます。

「戦績」では、次の内容を確認できます。

- 通算の試合数、勝敗、勝率、最高ラリー
- 初級・中級・上級ごとの試合数と勝数
- 直近10試合の日時、難易度、スコア、最大ラリー、試合時間

記録はブラウザの IndexedDB に保存され、外部へ送信されません。保存先は現在使っているブラウザ・端末内だけです。別の端末やブラウザとは同期されず、ブラウザのサイトデータを削除すると記録も消えます。プレイヤーを削除した場合は、そのプレイヤーの戦績も一緒に削除され、元に戻せません。

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
│   ├── ai.ts
│   ├── physics.ts
│   ├── rules.ts
│   ├── stats.ts
│   ├── storage.ts
│   ├── utils.ts
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
│   ├── opponent-ai.test.ts
│   ├── stats.test.ts
│   ├── player-stats.spec.js
│   └── game-smoke.spec.js
├── icons/
└── docs/
```
