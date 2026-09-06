# Design QA：table-tennis2 v0.1.1 コーナースコア

- Source visual truth: `docs/assets/mock_corner-score_concept_2026-08-03.png`
- Source pixels: 1844×853、24bpp RGB
- Implementation v1: `design-qa/implementation-rally-wide-844x390-v1.jpg`
- Implementation v2: `design-qa/implementation-rally-wide-844x390-v2.jpg`
- Compact evidence: `design-qa/implementation-compact-568x320.jpg`
- Wide viewport / implementation pixels: 844×390 CSS px / 844×390 pixels、devicePixelRatio 1
- Compact viewport / implementation pixels: 568×320 CSS px / 568×320 pixels、devicePixelRatio 1
- State: wideはラリー中、compactはプレイヤーサーブ選択中
- Browser: ユーザーChrome

## Findings

最終比較で、対応が必要なP0 / P1 / P2差異はない。

### Required fidelity surfaces

- Fonts and typography: 既存アプリのsystem UIとmonospace得点を維持した。得点30px、ラベル11px、中央メタ11px / RALLY 10pxで、モックの得点優先階層を再現している。compactは得点26pxへ縮小し、プレイヤー名は固定幅内で省略する。
- Spacing and layout rhythm: wideの得点バッジは92×48px、中央メタは132×28px。相手とプレイヤーをstage両端へ分離し、中央の連続した暗色面を撤去した。left rail 156px、right rail約203px、stage約485pxは既存シェル契約を維持する。
- Colors and visual tokens: 濃紺のrail、体育館の床、青い卓球台、オレンジの得点、ミントの状態表示を既存tokenから使用した。新しい外部paletteは追加していない。
- Image quality and asset fidelity: 実行時の新規画像資産はない。既存Canvas描画をそのまま使い、モック画像や外部製品資産をゲームへ埋め込んでいない。
- Copy and content: `あいて`、プレイヤー名、難易度、`RALLY`、`サーブ`、`設定`、`音`、`振動`、`ラリー中`を設計正本どおり表示する。
- Icons: コンセプトモックのicon-only操作は、正本設計の日本語ラベルbuttonへ置き換えた。固有アイコンの模倣や新規依存を避けつつ、44px操作領域と明示的なaccessible nameを確保する意図的な差異である。
- Responsiveness: 568×320でleft railを非表示にしても両得点と中央メタを維持する。得点バッジ44px以下、中央メタ24px、serve controls下端308pxでviewport内に収まる。
- Accessibility and interaction: HUDはpointer inputを遮らず、操作buttonは44px以上。音・振動は `aria-pressed` とvisual stateを同期し、設定から一時停止・再開できる。Chrome console warning / errorは0件だった。

## Full-view comparison evidence

- Source: `docs/assets/mock_corner-score_concept_2026-08-03.png`
- Final wide: `design-qa/implementation-rally-wide-844x390-v2.jpg`
- 共通する主要構成は、stage左右上隅の得点、上部中央の小型メタ、left railの現在サーバー、right railの設定・音・振動・状態である。
- モックはコンセプト画像であり、レール幅、button文言、正確な寸法、レスポンシブ状態は `docs/修正設計書_横画面HUDコーナースコア化_2026-08-03.md` を正本として比較した。
- screenshot内の大きな打球名は既存flashの一時表示であり、本修正の恒常HUD差異ではない。

## Focused region comparison evidence

- 得点領域: 両バッジはstage端へ分離され、中央メタは28px以下。三要素の矩形は重ならない。
- left rail: v1の囲みcardを、モックに近いdivider + inline server表示へ修正した。
- right rail: v1の全幅buttonを96px中央揃えへ修正し、モックの縦方向の小型操作群へ近づけた。
- compact: source mockにcompact画像はないため、設計書の数値契約と `implementation-compact-568x320.jpg`、矩形E2Eを比較根拠とした。

## Comparison history

### Iteration 1 — blocked

- [P2] left railの現在サーバーが独立したrounded cardとなり、モックよりsurfaceが重かった。
- [P2] right railの設定・音・振動がrail全幅となり、モックより操作群の視覚占有が大きかった。
- Evidence: `design-qa/implementation-rally-wide-844x390-v1.jpg`

### Fixes

- `.match-context`をborder/background付きcardから、上dividerとinline label/valueへ変更した。
- `.rail-action`を最大96px・中央揃えへ変更し、44px以上の操作領域は維持した。

### Iteration 2 — passed

- Evidence: `design-qa/implementation-rally-wide-844x390-v2.jpg`
- P2だったsurfaceと操作占有を解消した。得点・中央メタ・左右railの情報階層はモックと設計正本に一致し、新しいP0 / P1 / P2は確認されなかった。

## Open Questions

- なし。将来icon-only表示へ変更する場合は、アイコンライブラリ追加とaccessible labelを別設計で判断する。

## Implementation Checklist

- [x] wide 844×390のcorner scoreと左右railを確認
- [x] compact 568×320の矩形と操作領域を確認
- [x] 設定、一時停止、音、振動の操作を確認
- [x] console warning / error 0件を確認
- [x] v1のP2差異を修正してv2を再比較

## Follow-up Polish

- P3: 打球flashが重なる瞬間の撮影ではHUD比較がしづらいため、将来のvisual regression用fixtureでゲーム時間を固定すると比較しやすい。製品挙動の変更は不要。

final result: passed

---

# Design QA：table-tennis2 v0.3.0 グラフィック強化と演出

- Source visual truth: 設計書 [修正設計書_グラフィック強化と演出完成度向上_2026-09-06](docs/修正設計書_グラフィック強化と演出完成度向上_2026-09-06.md) §5.2〜§5.10 の記述（モック画像はない）
- Baseline: v0.2.4 の `design-qa/implementation-rally-wide-844x390-v2.jpg`
- Wide evidence: `design-qa/v030-rally-wide-844x390.jpg` / `v030-serve-wide-844x390.jpg` / `v030-point-wide-844x390.jpg` / `v030-final-point-wide-844x390.jpg`
- Compact evidence: `design-qa/v030-rally-compact-568x320.jpg` / `v030-serve-compact-568x320.jpg`
- Viewport / pixels: 844×390 と 568×320 CSS px、devicePixelRatio 1
- Capture: `node scripts/capture-design-qa.mjs`（production build の `vite preview` を Chromium で撮影。決定論のため `Math.random` を固定）
- Console: 撮影中の warning / error は 0 件（スクリプトが検出したら異常終了する）
- Browser: 撮影は Chromium。実 Chrome での手動受入は G2 で別途実施する

## Findings

### P0

なし。

### P1

なし。

### P2

- ~~**相手プレイヤーが台にほぼ隠れる**~~ → **是正済み（2026-09-07）**。相手の接触面 `z`（30〜178）で描くと天板奥端の投影 y（約 107px）に胴上端（約 105px）が重なり、可視部分が頭部だけになっていた。描画専用の `OPPONENT_DRAW_Z = 240` を追加して `HL = 137` より奥へ固定し、頭・胴・腰・サーブ待ちの球が天板の上に出て膝から下だけが隠れるようにした。描画順（相手は L1 より前）と判定面 `OpponentAi.state.z` は変更していない。
- **サーブ着地帯が非常に淡い（現状維持と判断・2026-09-07）**: 設計値の塗り `rgba(126,224,168,.10)` と縁 `rgba(126,224,168,.35)` 幅 1.5 は、青い天板の上ではスクリーンショット上ほぼ判別できない。Canvas の画素差分では短い／長いで 5743px の差が出ており描画自体は成立している。視認性を上げるには設計値の変更が必要なため、判断をユーザーへ回す。
- **死球が画面外になる得点がある**: 「返せず」「アウト」でプレイヤー側の床へ落ちた球は、`z` が `-250` 付近まで下がると投影 y が 1000px を超え、viewport の下に出る。ネット・サーブフォルト・自陣に落下など台上・台際で止まる得点では設計どおり残留が見える。投影は `projectScale()` の下限 24 でクランプされるため、破綻や巨大描画は発生しない。

## Required fidelity surfaces

- Fonts and typography: 既存の system UI を維持。打球トーストは 13px（wide 14px）/ 800、得点バナーは 20px（wide 22px）/ 800 と 13px の 2 行、状況チップは 11px。得点 30px・ラベル 11px・中央メタ 11px の v0.1.1 契約は変更していない。
- Spacing and layout rhythm: 得点バッジ 92×48 / 76×44、中央メタ 132×28 / 112×24、rail 幅は不変（E-V5 で検査）。新規要素はすべて stage 相対で `pointer-events: none`。トーストは `#matchMeta` 直下 54px（wide 60px）、状況チップ表示中は 78px（wide 86px）へ下がる。
- Colors and visual tokens: 会場を `#1c2128 → #3d454f` の壁と `#6e4d2a → #c49559` の床へ暗色化し、周縁の暗がりと天板中央への放射光を追加した。台は `#17466a → #236a9c`、ネットは `rgba(232,238,244,.26)`。得点者色は緑 `#7ee0a8` / 橙 `#ff8a6b` で、いずれも**文字と併記**する。新しい外部 palette は追加していない。
- Image quality and asset fidelity: 実行時の新規画像・フォント・音声資産はない。会場・観客・照明・網はすべて Canvas API の手続き描画で、模様の揺らぎはインデックス由来の決定論値（`deterministicUnit()`）で作る。
- Copy and content: `あなたの得点` / `あいての得点`、5 理由（ネット／アウト／返せず／サーブフォルト／自陣に落下）、`デュース` / `マッチポイント` / `相手マッチポイント`、品質ラベル 4 種、`台をタップ か 左右フリックでサーブ`、`最長ラリー N` を設計正本どおり表示する。
- Icons: 新規アイコンは追加していない。
- Responsiveness: 568×320 でも両得点・中央メタ・ヒント pill・サーブ操作が viewport 内に収まる。静的レイヤは `layerKey`（幅×高さ@dpr）が変わったときだけ再生成する。
- Accessibility and interaction: 得点者・品質・状況は**文字**で示し、色は補助。`#pointBanner` / `#situation` は `aria-live="polite"`。`prefers-reduced-motion: reduce` では粒子・集中線・ネット揺れ・パルス・待機揺らぎ・グロー脈動を止め、情報表示は残す（U-V11 / E-V3 / E-V2'）。

## Comparison history

| 版 | 証跡 | 結果 |
|---|---|---|
| v0.3.0（本版） | `v030-*.jpg` 6 枚（2026-09-07 再撮影） | P0 / P1 差異なし。P2 3 件のうち相手の可視性は是正済み、着地帯の淡さは現状維持と確定、死球の画面外は幾何どおりで是正不要 |
| v0.2.4 以前 | `implementation-*.jpg` | 上記 v0.1.1 節を参照 |

## 実装中に発見し是正した描画欠陥

- **柵と観客帯が床に隠れた**: `drawFloor()` は地平線から画面下端まで塗るが、横画面（844×390）では地平線 `camera.cy ≈ -20.5px` が viewport 上端より上に来るため、床の塗りが画面全体を覆う。初回実装では設計 §5.2 の記述順（観客帯 → 柵 → 床）どおりに描いたため、柵と観客帯が消えた。床を先に描く順序へ是正した（観客帯が柵の後ろに来る前後関係は維持）。
