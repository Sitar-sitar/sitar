# シタール (Sitar)

崩壊スターレイルのキャラクター・光円錐・遺物・用語集をまとめたファンメイドのデータベースサイト。Next.js 15 + TypeScript + Zod + Tailwind CSS で構築されています。

## セットアップ

```sh
npm install
npm run dev   # http://localhost:3000
```

## コマンド

| コマンド | 用途 |
|---|---|
| `npm run dev` | 開発サーバ起動 |
| `npm run build` | 本番ビルド (データ検証も自動で走る) |
| `npm run start` | ビルド済みアプリを起動 |
| `npm run validate` | `src/data/**` のデータを Zod + 参照整合性で検証 |
| `npm run typecheck` | TypeScript の型チェック |
| `npm run lint` | ESLint 実行 |

## ディレクトリ構成

```
src/
├── app/                # Next.js App Router (ページ)
├── components/         # UI コンポーネント
├── data/               # ★ ここに JSON を追加するだけでデータが増える
│   ├── characters/
│   ├── light-cones/
│   ├── relics/
│   └── glossary/
└── lib/
    ├── schemas/        # Zod スキーマ (ここがデータ仕様の正典)
    ├── loader.ts       # JSON 読み込み + 参照整合性チェック
    └── search.ts       # 検索インデックス生成
scripts/
└── validate-data.ts    # CI 向けの検証スクリプト
```

## 新しいデータを追加する

### 1. 該当カテゴリの JSON を追加

ファイル名 (拡張子除く) は `id` と完全一致させます。slug は小文字・数字・ハイフンのみ使用可。

| カテゴリ | 追加先 | スキーマ |
|---|---|---|
| キャラ | `src/data/characters/<slug>.json` | `src/lib/schemas/character.ts` |
| 光円錐 | `src/data/light-cones/<slug>.json` | `src/lib/schemas/light-cone.ts` |
| 遺物 | `src/data/relics/<slug>.json` | `src/lib/schemas/relic.ts` |
| 用語集 | `src/data/glossary/<slug>.json` | `src/lib/schemas/glossary.ts` |

### 2. 検証

```sh
npm run validate
```

- Zod スキーマで構造を検証
- 参照整合性 (ビルド推奨の光円錐/遺物ID、編成例のキャラID、関連用語IDなど) を検証
- ファイル名と `id` が一致しているかを検証

エラーが出たらファイル名+該当パス付きで表示されます。

### 3. プレビュー

```sh
npm run dev
```

`/characters/<slug>` などに自動でページが生えるので、内容を確認。

### 4. コミット → PR

GitHub フローに沿ってレビュー後にマージ。`npm run build` がパスすればデータに矛盾はありません。

## データ仕様のポイント

- **属性**: `physical / fire / ice / lightning / wind / quantum / imaginary`
- **命途**: `destruction / hunt / erudition / harmony / nihility / preservation / abundance / remembrance`
- **キャラレア度**: `4 | 5`、光円錐レア度: `3 | 4 | 5`
- **星魂は 6 件必須** (`CharacterSchema` で `.length(6)`)
- **洞窟遺物は `head/hands/body/feet` + 2/4セット効果**、**次元界遺物は `sphere/rope` + 2セット効果のみ**。これらはスキーマで強制。
- **ビルドの `lightCones` / `relicSets.sets` / `teamComps.members` / `glossary.relatedTerms` / `relatedCharacters` は ID 参照**。実在しなければビルドが失敗します。

## 技術的な注意

- 全ページは SSG (静的生成)。`generateStaticParams` でデータから全ページを列挙。
- 検索のみクライアント側 (`fuse.js`) で動作。
- このサイトは非公式なファンメイドです。権利はすべて原著作者に帰属します。
