# 修正設計書：table-tennis2 サブパスのService Worker分離

本書は、公開済み `table-tennis` v0.6.2 のroot Service Workerが、新規アプリ `/sitar/table-tennis2/` のnavigationと資産を既存アプリとして処理しないための修正仕様を定める。

- 作成日: 2026-08-03
- 対象アプリ: table-tennis
- 種別: 修正設計書
- 対象バージョン: v0.6.3
- 前提コミット: `302512b49501c23dc3243bb79b65bd67fc060a80`（公開基準）
- ステータス: 実装済み・公開済み
- 関連: [table-tennis2 横画面版全体設計](../../table-tennis2/docs/実装設計書_横画面版全体設計_2026-08-03.md) / [設計書インデックス](./設計書インデックス.md)

## 1. 目的・背景

現行workerのscopeはPages root `/sitar/` であり、未知のnavigationが失敗すると既存 `index.html` へfallbackする。新URL `/sitar/table-tennis2/` を同じPages artifactへ追加すると、root workerが子アプリの初回・offline navigationを横取りし得る。既存URLと子URLの所有権を明示分離する。

## 2. スコープ

### 2.1 IN

- `table-tennis/sw.js` が `table-tennis2/` 配下のGETを処理対象外にする。
- package/SW cacheをv0.6.3へ更新し、既存クライアントへ修正版workerを配布する。
- source契約テストと合成Pages artifact検査を追加する。

### 2.2 OUT

- 既存ゲーム、物理、UI、IndexedDB、既存URLの変更。
- 子アプリのcacheやDBをroot workerから削除すること。
- root workerのscope変更・登録解除。

## 3. 現状と非破壊条件

- `sw.js` は同一origin GETをcacheし、navigation失敗時に `./index.html` へfallbackする。
- 既存 `https://sitar-sitar.github.io/sitar/` は引き続き同じゲームを返し、online/offline起動を維持する。
- `table-tennis-` cacheの世代管理だけを行い、`table-tennis2-` cacheには触れない。
- bypass対象はregistration scopeから導出する `table-tennis2/` pathnameで判定し、host名や `/sitar/` を固定文字列にしない。

## 4. 詳細仕様

`fetch` listenerの冒頭で、request URLのpathnameが `new URL("./table-tennis2/", self.registration.scope).pathname` から始まる場合は `respondWith()` を呼ばずreturnする。これにより、子worker未制御時は通常network、制御後は子scopeのworkerが所有する。

- query/hashはpathname判定へ影響しない。
- `/table-tennis2-other/` はprefix一致しない。
- cross-origin requestは既存挙動を変えない。
- bypass経路はroot cacheへのput、root navigation fallback、cache削除を一切行わない。

## 5. 変更ファイルと実装順

1. `package.json` / `package-lock.json` をv0.6.3、`sw.js` cache名を `table-tennis-v0.6.3` へ更新する。
2. `sw.js` に子pathname導出とfetch冒頭bypassを追加する。
3. `tests/app-contract.test.mjs` にscope相対導出・`respondWith`前return・prefix境界の契約検査を追加する。
4. 合成 `_site` 構築・検査とPages workflowを更新し、両アプリcheck成功時だけdeployする。

## 6. テスト・受け入れ条件

- `table-tennis` と `table-tennis2` の `npm run check` が成功する。
- root workerが自身の既存app shellをcacheし、子pathnameを扱わない契約テストが成功する。
- `_site/index.html` と `_site/table-tennis2/index.html`、両worker・manifest・assetsが存在する。
- Pages公開後、既存URLと新規URLのHTML/JS/CSS/manifest/SW/iconsがHTTP 200。
- Chromeで既存URLが従来タイトル、新URLが「卓球 横画面」を表示し、新URLで試合開始できる。
- 両URLでworker script URLとscopeが分離し、console error 0件。

## 7. リスク・ロールバック

- bypass順序を誤るとroot workerが子indexを返す。source契約と公開Chromeで検出する。
- 合成artifactの片側欠落はsite検査でdeploy前に停止する。
- 障害時は直前成功commit `302512b` のroot-only artifactを再deployできる。既存・新規IndexedDBは削除しない。

## 8. 未確定・要確認事項

- ブロッキング事項なし。ユーザーはcommit・push・Pages公開を明示承認済み。

## 変更履歴

| 日付 | 内容 |
|---|---|
| 2026-08-03 | v0.6.2 root workerからtable-tennis2配下を分離し、v0.6.3として合成Pages公開する修正契約を新規作成。 |
| 2026-08-03 | commit `90d9339`で実装し、Actions run `30804672457` / Pages deployment `5724474145`で公開。既存rootとchildの自動検証、HTTP/PWA資産一致、Chrome表示・開始操作を確認。 |
