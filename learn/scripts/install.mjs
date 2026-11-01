// 学習キットを共通レイアウトに1行だけ入れる。何度動かしても二重には入らない。
//   node learn/scripts/install.mjs
import { readFileSync, writeFileSync } from "node:fs";

const cfg = JSON.parse(readFileSync("learn/targets.json", "utf8"));
const LINE =
  '        <script async src="/learn-kit.js" data-app="age3-shinshohin-tool" data-endpoint={process.env.NEXT_PUBLIC_SUPABASE_URL} data-key={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY} />';

let changed = 0;
for (const t of cfg.targets) {
  const src = readFileSync(t.layout, "utf8");
  const n = src.split("learn-kit.js").length - 1;
  if (n >= 1) {
    console.log(`そのまま（入っています）: ${t.layout}`);
    continue;
  }
  const anchor = "{children}";
  if (src.split(anchor).length - 1 !== 1) throw new Error(`${t.layout} に {children} がちょうど1つありません`);
  const next = src.replace(anchor, `${anchor}\n${LINE}`);
  writeFileSync(t.layout, next);
  changed++;
  console.log(`入れました: ${t.layout}`);
}
console.log(changed ? `${changed}件に入れました` : "変更なし");
