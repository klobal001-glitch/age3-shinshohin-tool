// 学習キットの入れ忘れ・入れすぎ・対外向けへの混入を数える。
//   node learn/scripts/check.mjs          … ソースだけを見る
//   node learn/scripts/check.mjs --out    … 書き出した out/ の HTML も1ページずつ数える
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const cfg = JSON.parse(readFileSync("learn/targets.json", "utf8"));
const problems = [];
const count = (s, w) => s.split(w).length - 1;

const kit = readFileSync(cfg.kit, "utf8");
if (/<\/script/i.test(kit)) problems.push(`${cfg.kit} にスクリプトの閉じタグの文字列がある`);

for (const t of cfg.targets) {
  const n = count(readFileSync(t.layout, "utf8"), "learn-kit.js");
  if (n !== 1) problems.push(`${t.layout}: 読み込みが ${n} 件（1件であるべき）`);
}
for (const p of cfg.pageOff) {
  if (!readFileSync(p.file, "utf8").includes("data-learn-kit-off")) problems.push(`${p.file}: ページ単位の停止が入っていない`);
}
for (const e of cfg.excluded) {
  if (existsSync(e.file) && count(readFileSync(e.file, "utf8"), "learn-kit.js") > 0) problems.push(`${e.file}: 対外向けに混入している`);
}

let pages = 0;
if (process.argv.includes("--out")) {
  const walk = (d) =>
    readdirSync(d).flatMap((f) => {
      const p = join(d, f);
      return statSync(p).isDirectory() ? walk(p) : p.endsWith(".html") ? [p] : [];
    });
  for (const f of walk("out")) {
    if (/\/(404|_not-found)/.test(f)) continue;
    pages++;
    const n = count(readFileSync(f, "utf8"), 'src="/learn-kit.js"');
    if (n !== 1) problems.push(`${f}: 読み込みが ${n} 件`);
  }
}

console.log(`対象レイアウト ${cfg.targets.length} / ページ単位で止める画面 ${cfg.pageOff.length} / 除外 ${cfg.excluded.length}` + (pages ? ` / 書き出したページ ${pages}` : ""));
if (problems.length) {
  console.log("問題:\n- " + problems.join("\n- "));
  process.exit(1);
}
console.log("問題なし");
