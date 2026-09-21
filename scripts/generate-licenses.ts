/**
 * 依存パッケージのライセンス一覧を生成する。
 *
 *   bun run licenses:generate
 *
 * 手で書くと必ず実態とずれるので、package.json の依存から機械的に作る。
 * 生成物 (data/licenses.json) はコミットする。実行時に node_modules を
 * 読みに行くと、standalone ビルドで壊れるため。
 */
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

type Entry = {
  name: string;
  version: string;
  license: string;
  homepage: string | null;
};

const ROOT = process.cwd();

async function readJson(file: string): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return null;
  }
}

/** package.json の license は文字列だったりオブジェクトだったりする。 */
function normalizeLicense(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "type" in value) {
    return String((value as { type: unknown }).type);
  }
  return "(不明)";
}

function normalizeHomepage(pkg: Record<string, unknown>): string | null {
  const homepage = pkg.homepage;
  if (typeof homepage === "string" && /^https?:\/\//.test(homepage)) return homepage;

  const repository = pkg.repository;
  const url =
    typeof repository === "string"
      ? repository
      : repository && typeof repository === "object" && "url" in repository
        ? String((repository as { url: unknown }).url)
        : null;

  if (!url) return null;
  const cleaned = url.replace(/^git\+/, "").replace(/\.git$/, "");
  return /^https?:\/\//.test(cleaned) ? cleaned : null;
}

async function collect(): Promise<Entry[]> {
  const rootPkg = await readJson(path.join(ROOT, "package.json"));
  if (!rootPkg) throw new Error("package.json を読めませんでした。");

  // 直接の依存だけを出す。推移的な依存まで並べると数百件になり、
  // 誰も読まない一覧になる。
  const names = [
    ...Object.keys((rootPkg.dependencies as Record<string, string>) ?? {}),
    ...Object.keys((rootPkg.devDependencies as Record<string, string>) ?? {}),
  ].sort((a, b) => a.localeCompare(b));

  const entries: Entry[] = [];

  for (const name of names) {
    const pkg = await readJson(
      path.join(ROOT, "node_modules", ...name.split("/"), "package.json"),
    );
    if (!pkg) {
      entries.push({ name, version: "(未取得)", license: "(不明)", homepage: null });
      continue;
    }

    entries.push({
      name,
      version: String(pkg.version ?? "(不明)"),
      license: normalizeLicense(pkg.license ?? pkg.licenses),
      homepage: normalizeHomepage(pkg),
    });
  }

  return entries;
}

const entries = await collect();
await mkdir(path.join(ROOT, "data"), { recursive: true });
await writeFile(
  path.join(ROOT, "data", "licenses.json"),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), entries }, null, 2)}\n`,
  "utf8",
);

console.log(`${entries.length} 件のライセンスを data/licenses.json に書き出しました。`);

// 出どころが分からないものは目立たせる。放置すると法務的に困る。
const unknown = entries.filter((entry) => entry.license === "(不明)");
if (unknown.length > 0) {
  console.warn("ライセンス不明:", unknown.map((entry) => entry.name).join(", "));
}

// node_modules を読むだけなので、Bun の型がなくても動くよう readdir は未使用。
void readdir;
