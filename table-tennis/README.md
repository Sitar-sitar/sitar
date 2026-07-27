# 卓球

スマートフォンとPCのブラウザで遊べる、1ファイル構成の3D卓球ゲームです。
PWAに対応しており、ホーム画面へ追加するとアプリのように起動できます。

## 遊び方

- スマートフォン: 画面をドラッグしてラケットを操作します。
- PC: マウスを動かしてラケットを操作します。
- 設定ボタンから難易度や効果音を変更できます。

## ローカルで確認

Service Workerを利用するため、ファイルを直接開かずローカルWebサーバー経由で表示してください。

```sh
python -m http.server 8000
```

その後、`http://localhost:8000/` を開きます。

## GitHub Pages

このリポジトリはGitHub Pagesでそのまま公開できる構成です。
公開元は既定ブランチのルートディレクトリを指定してください。

## ファイル構成

```text
.
├── index.html
├── manifest.webmanifest
├── sw.js
├── icons/
│   ├── apple-touch-icon.png
│   ├── icon-192.png
│   ├── icon-512.png
│   └── icon-maskable-512.png
└── README.md
```
