import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: {
    default: "シタール — 崩壊スターレイル データベース",
    template: "%s | シタール",
  },
  description:
    "崩壊スターレイルのキャラクター・光円錐・遺物・用語集をまとめたファンメイドのデータベースサイト。",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-hsr-bg text-hsr-text antialiased">
        <Nav />
        <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6">
          {children}
        </main>
        <footer className="border-t border-hsr-border py-8 text-center text-sm text-hsr-muted">
          © シタール / 本サイトはファンメイドの非公式データベースです。
        </footer>
      </body>
    </html>
  );
}
