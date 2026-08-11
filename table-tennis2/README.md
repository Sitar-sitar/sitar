# 卓球 横画面（table-tennis2）

既存 `table-tennis` v0.6.2 のゲーム仕様を独立継承し、スマートフォン横画面を主対象にする1人用3D卓球ゲームです。PWAに対応しており、ホーム画面へ追加すると既存版とは別アプリとして起動できます。v0.2.1では、9種類・3段階の長さのサーブ、台上技術、端末内戦績、横画面HUD、実衝突を維持しながら、ラケットの追従性と通常返球の分かりやすさを改善しました。

## 横画面HUD

- 得点は相手をstage左上、プレイヤーをstage右上に表示します。
- 難易度とラリー数は上部中央の小型表示にまとめます。
- 幅760px以上ではleft railに現在のサーバーを表示します。
- right railから設定を開け、ラリー中は音と振動も直接切り替えられます。
- 568〜759pxではleft railを隠しても、両得点とサーバー点はstage内に残ります。

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

- スマートフォン: 画面をドラッグすると、ラケット中心が指より画面高の6%上をX/Y両方向へ追従します。
- PC: マウスをドラッグすると、ラケット中心がポインターより画面高の1%上をX/Y両方向へ追従します。
- ポインターイベントの間は最大16msだけ移動方向を予測し、描画と衝突は同じラケット中心を使います。
- ラリー中は接触可能範囲を白い補助輪郭で表示します。ボール外周が輪郭内へ入り、奥行きも合ったときだけ返球し、明確に外すと空振りになります。
- ボールへ位置を合わせるだけの左右移動や遅い上下移動は、弱い「押し出し」として返球します。返球コースは補助輪郭内の接触位置で決まります。
- 上フリック: ドライブ。高い球を強く振るとスマッシュ。
- 下フリック: ツッツキ。
- 短い球: 下フリックでストップ、上フリックでフリック。
- 指やマウスを置くだけ: 押し出し。
- 直前80msに十分な速さ・変位を持つ明示的な上下ストロークだけが、ドライブ、スマッシュ、ツッツキなどの技になります。
- 明示的な上下ストローク中に曲線を描いた場合だけ、曲がる向きに応じて横回転が加わります。
- right railの設定ボタン: 一時停止画面を開く。
- ラリー中の音・振動ボタン: 効果音と振動を直接切り替える。

### ラケットの見え方

ラケットにはブレードと持ち手が描かれます。プレイヤー側は接触前から入力方向へ傾き、接触時に短く光った後、待機位置へ戻ります。相手のラケットは従来どおり、持ち手が腕の向きに合わせて描かれます。

打つ位置が台に近い（奥の）ときはラケットが小さく、手前のときは大きく描かれます。描画と衝突判定は同じ投影式とラケット姿勢を使うため、見た目と当たり判定のずれを抑えています。

比較や緊急回避が必要な場合だけ、URLへ `?controlModel=legacy` を付けるとv0.1.1までの左右位置指定・接触面返球へ一時的に戻せます。この指定は保存されません。入力軌跡と接触観測値は `?debugInput=1` で開いた開発確認時だけ表示します。

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

その後、`http://localhost:3039/` を開きます。同一ネットワーク内のスマートフォンからは、PCのIPアドレスを使って確認できます。

横向き568×320以上が必要です。568〜759px幅ではstageとright rail、760px以上ではleft rail・stage・right railを表示します。両得点はどちらの幅でもstage上隅に表示されます。縦画面または最小未満ではゲームを停止し、回転案内を表示します。

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
npm run test:e2e:stability
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
3. `table-tennis` と `table-tennis2` の両方で `npm run check` を実行。
4. 既存版をroot、新規版を `/table-tennis2/` に配置した `_site/` を検査。
5. 合成した `_site/` をPages artifactとしてデプロイ。

Pull Requestでは `.github/workflows/test-table-tennis2.yml` が新規版の全検証を行います。公開URLは次です。

<https://sitar-sitar.github.io/sitar/table-tennis2/>

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
│   ├── storage-schema.ts
│   ├── storage.ts
│   ├── utils.ts
│   ├── input.ts
│   ├── render.ts
│   ├── control/
│   │   ├── stroke.ts
│   │   ├── paddle.ts
│   │   ├── contact.ts
│   │   └── shot-intent.ts
│   ├── ui.ts
│   ├── feedback.ts
│   ├── config.ts
│   ├── types.ts
│   ├── view/
│   │   ├── camera.ts
│   │   ├── input-math.ts
│   │   ├── layout.ts
│   │   ├── orientation.ts
│   │   ├── projection.ts
│   │   └── suspension.ts
│   ├── ui/
│   │   ├── feature.ts
│   │   └── features/serve-panel.ts
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
│   ├── check-dist.mjs
│   └── generate-icons.ps1
├── tests/
│   ├── app-contract.test.mjs
│   ├── game-core.test.ts
│   ├── opponent-ai.test.ts
│   ├── storage-schema.test.ts
│   ├── stats.test.ts
│   ├── timing.test.ts
│   ├── player-stats.spec.js
│   └── game-smoke.spec.js
├── icons/
└── docs/
```
