import Link from "next/link";
import { notFound } from "next/navigation";
import { loadAll, getGlossary } from "@/lib/loader";
import { GLOSSARY_CATEGORY_LABEL } from "@/lib/schemas/glossary";

type Params = { slug: string };

export function generateStaticParams(): Array<Params> {
  return loadAll().glossary.map((g) => ({ slug: g.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const g = getGlossary(slug);
  return { title: g ? g.term : "用語集" };
}

export default async function GlossaryDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const g = getGlossary(slug);
  if (!g) notFound();

  const { glossary, characters } = loadAll();
  const termsById = new Map(glossary.map((x) => [x.id, x]));
  const charsById = new Map(characters.map((x) => [x.id, x]));

  return (
    <article className="space-y-6">
      <header className="rounded-2xl border border-hsr-border bg-hsr-surface p-6">
        <p className="text-xs text-hsr-accent">
          {GLOSSARY_CATEGORY_LABEL[g.category]}
        </p>
        <h1 className="mt-1 text-3xl font-semibold">
          {g.term}
          {g.reading && (
            <span className="ml-3 text-sm text-hsr-muted">{g.reading}</span>
          )}
        </h1>
        <p className="mt-3 text-sm text-hsr-muted">{g.summary}</p>
      </header>

      <section className="rounded-2xl border border-hsr-border bg-hsr-surface p-6 text-sm leading-relaxed">
        <p className="whitespace-pre-wrap">{g.description}</p>
      </section>

      {g.relatedTerms && g.relatedTerms.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">関連用語</h2>
          <ul className="flex flex-wrap gap-2">
            {g.relatedTerms.map((id) => (
              <li key={id}>
                <Link
                  href={`/glossary/${id}`}
                  className="rounded-full bg-hsr-surface px-3 py-1 text-sm ring-1 ring-hsr-border hover:text-hsr-accent"
                >
                  {termsById.get(id)?.term ?? id}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {g.relatedCharacters && g.relatedCharacters.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">関連キャラ</h2>
          <ul className="flex flex-wrap gap-2">
            {g.relatedCharacters.map((id) => (
              <li key={id}>
                <Link
                  href={`/characters/${id}`}
                  className="rounded-full bg-hsr-surface px-3 py-1 text-sm ring-1 ring-hsr-border hover:text-hsr-accent"
                >
                  {charsById.get(id)?.name ?? id}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
