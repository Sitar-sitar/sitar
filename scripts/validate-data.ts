import { loadAll } from "../src/lib/loader";

try {
  const data = loadAll();
  console.log(
    `OK: characters=${data.characters.length}, lightCones=${data.lightCones.length}, relicSets=${data.relicSets.length}, glossary=${data.glossary.length}`,
  );
} catch (err) {
  console.error((err as Error).message);
  process.exit(1);
}
