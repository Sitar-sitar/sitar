import Link from "next/link";

const NAV_ITEMS = [
  { href: "/characters", label: "キャラクター" },
  { href: "/light-cones", label: "光円錐" },
  { href: "/relics", label: "遺物" },
  { href: "/glossary", label: "用語集" },
  { href: "/search", label: "検索" },
];

export function Nav() {
  return (
    <header className="sticky top-0 z-10 border-b border-hsr-border bg-hsr-bg/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-6 px-4 py-3">
        <Link
          href="/"
          className="text-lg font-semibold tracking-wide text-hsr-accent"
        >
          シタール <span className="text-hsr-muted">Sitar</span>
        </Link>
        <nav className="flex flex-wrap gap-4 text-sm">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-hsr-text/80 transition hover:text-hsr-accent"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
