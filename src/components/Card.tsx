import Link from "next/link";
import type { ReactNode } from "react";

export function Card({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-xl border border-hsr-border bg-hsr-surface p-4 transition hover:border-hsr-accent/60 hover:bg-hsr-surface/70"
    >
      {children}
    </Link>
  );
}
