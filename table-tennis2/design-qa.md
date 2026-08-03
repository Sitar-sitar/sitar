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
