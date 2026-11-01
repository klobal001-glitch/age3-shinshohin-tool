// 毎晩の集計（AIは使わない）。
//
//   node learn/scripts/aggregate.mjs                 … 前日（日本時間）の分を集計
//   node learn/scripts/aggregate.mjs --date 2026-11-01
//   node learn/scripts/aggregate.mjs --local dir/    … 保管場所の代わりに手元のJSONを読む（検査用）
//
// 1. 保管場所（Supabase Storage の genba-photos/learn/raw/<日付>/）から、その日の記録を読む
// 2. 数字・メールをもう一度伏せる（ブラウザ側で伏せたものを、ここでも念のため）
// 3. 画面ごとの利用数・多いエラー・通信の失敗・遅い表示・ご意見の一覧にまとめる
// 4. learn/daily/<日付>.json と learn/latest.json に書く（AIが最初に読むのは latest.json の1枚だけ）
// 5. 120日より古い生の記録を消す。保管場所の使用量が無料枠の8割を超えたら印を付ける
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const URL_ = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const KEY = process.env.SUPABASE_KEY || "";
const BUCKET = process.env.LEARN_BUCKET || "genba-photos";
const RAW = "learn/raw";
const KEEP_DAYS = 120;
const FREE_STORAGE_BYTES = 1024 * 1024 * 1024; // Supabase 無料枠のファイル置き場 1GB
const MAX_FILES_PER_DEVICE = 150; // 1台が1日に送れる量の上限（送りすぎの端末は切る）
const THRESHOLD = 3; // 同じエラー・通信の失敗・遅い表示が何回でAIを動かすか
const TEST_MARK = "【テスト】";

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const jst = (d) => new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const date = arg("--date") || jst(new Date(Date.now() - 24 * 3600 * 1000));
const localDir = arg("--local");

/** 伏せ字（ブラウザ側と同じ規則）。テストの印「【テスト】」は数字を含まないので残る */
export function redact(s, max = 200) {
  return String(s ?? "")
    .replace(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g, "[メール]")
    .replace(/[0-9０-９]+/g, "#")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
async function api(path, init = {}) {
  const res = await fetch(`${URL_}/storage/v1${path}`, {
    ...init,
    headers: { ...H, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  if (!res.ok) throw new Error(`${init.method || "GET"} ${path} → ${res.status} ${await res.text()}`);
  return res;
}
async function list(prefix) {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const res = await api(`/object/list/${BUCKET}`, {
      method: "POST",
      body: JSON.stringify({ prefix, limit: 1000, offset, sortBy: { column: "name", order: "asc" } }),
    });
    const page = await res.json();
    out.push(...page);
    if (page.length < 1000) return out;
  }
}
async function remove(paths) {
  for (let i = 0; i < paths.length; i += 500) {
    await api(`/object/${BUCKET}`, { method: "DELETE", body: JSON.stringify({ prefixes: paths.slice(i, i + 500) }) });
  }
}
/** 置き場全体の使用量（写真を含む）。フォルダを順にたどる */
async function bucketBytes(prefix = "") {
  let total = 0;
  for (const o of await list(prefix)) {
    const p = prefix ? `${prefix}/${o.name}` : o.name;
    if (o.id) total += o.metadata?.size || 0;
    else total += await bucketBytes(p);
  }
  return total;
}

async function readBatches() {
  if (localDir) {
    return readdirSync(localDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => ({ name: f, body: JSON.parse(readFileSync(join(localDir, f), "utf8")) }));
  }
  const files = (await list(`${RAW}/${date}`)).filter((o) => o.id && o.name.endsWith(".json"));
  const out = [];
  for (const f of files) {
    try {
      const res = await fetch(`${URL_}/storage/v1/object/public/${BUCKET}/${RAW}/${date}/${f.name}`);
      if (res.ok) out.push({ name: f.name, body: await res.json() });
    } catch {
      /* 壊れたファイルは飛ばす */
    }
  }
  return out;
}

function bump(map, key, n, extra) {
  const cur = map.get(key) || { ...extra, count: 0 };
  cur.count += n;
  map.set(key, cur);
}
const top = (map, n) => [...map.values()].sort((a, b) => b.count - a.count).slice(0, n);

/** 画面（URL）から、関係するファイルの見当をつける。AIにはこれだけを渡す */
const FILES = {
  "/": ["src/app/page.tsx", "src/components/Header.tsx", "src/components/Sidebar.tsx"],
  "/genba": ["src/app/genba/page.tsx", "src/components/genba/Header.tsx", "src/components/genba/CheckView.tsx"],
  "/genba#survey": ["src/components/genba/SurveyView.tsx"],
  "/genba#report": ["src/components/genba/ReportView.tsx"],
};

async function main() {
  const batches = await readBatches();
  const perDevice = new Map();
  const views = new Map();
  const clicks = new Map();
  const errors = new Map();
  const nets = new Map();
  const slows = new Map();
  const feedback = [];
  const devices = new Set();
  let events = 0;
  let dropped = 0;

  for (const { body } of batches) {
    const dev = redact(body.device, 40) || "unknown";
    const used = (perDevice.get(dev) || 0) + 1;
    perDevice.set(dev, used);
    if (used > MAX_FILES_PER_DEVICE) {
      dropped++;
      continue;
    }
    devices.add(dev);
    for (const e of Array.isArray(body.events) ? body.events.slice(0, 300) : []) {
      const n = Math.min(Math.max(Number(e.c) || 1, 1), 500);
      const p = redact(e.p, 80) || "/";
      events += n;
      if (e.t === "view") bump(views, p, n, { page: p });
      else if (e.t === "click") bump(clicks, `${p}|${redact(e.n, 40)}`, n, { page: p, name: redact(e.n, 40) });
      else if (e.t === "error") bump(errors, `${p}|${redact(e.m)}`, n, { page: p, message: redact(e.m), file: redact(e.s, 60) });
      else if (e.t === "net") bump(nets, `${p}|${redact(e.u, 100)}|${Number(e.s) || 0}`, n, { page: p, where: redact(e.u, 100), status: Number(e.s) || 0 });
      else if (e.t === "slow") bump(slows, `${p}|${redact(e.k, 10)}|${redact(e.u, 100)}`, n, { page: p, kind: redact(e.k, 10), where: redact(e.u, 100), maxMs: 0 });
      if (e.t === "slow") {
        const s = slows.get(`${p}|${redact(e.k, 10)}|${redact(e.u, 100)}`);
        s.maxMs = Math.max(s.maxMs, Math.min(Number(e.ms) || 0, 600000));
      }
      if (e.t === "fb") {
        const comment = redact(e.cm ?? "", 200);
        feedback.push({
          page: p,
          kind: e.v === "bad" ? "こまった" : "よかった",
          comment,
          test: comment.startsWith(TEST_MARK),
          at: new Date(Number(e.ts) || Date.now()).toISOString(),
          form: body.form === "mobile" ? "スマホ" : "PC",
        });
      }
    }
  }

  const realFeedback = feedback.filter((f) => !f.test);
  const reasons = [];
  if (realFeedback.length) reasons.push(`ご意見 ${realFeedback.length}件（こまった ${realFeedback.filter((f) => f.kind === "こまった").length}件）`);
  for (const e of top(errors, 50)) if (e.count >= THRESHOLD) reasons.push(`エラー ${e.count}回: ${e.message}`);
  for (const e of top(nets, 50)) if (e.count >= THRESHOLD) reasons.push(`通信の失敗 ${e.count}回: ${e.where}（${e.status || "つながらない"}）`);
  for (const e of top(slows, 50)) if (e.count >= THRESHOLD) reasons.push(`遅い${e.kind} ${e.count}回: ${e.page} ${e.where}`);
  const signal = reasons.length > 0;

  const pages = [...new Set([...views.keys(), ...feedback.map((f) => f.page), ...[...errors.values()].map((e) => e.page)])];
  const relatedFiles = [...new Set(pages.flatMap((p) => FILES[p] || FILES[p.split("#")[0]] || []))];

  const daily = {
    date,
    generatedAt: new Date().toISOString(),
    signal,
    reasons,
    totals: { batches: batches.length, devices: devices.size, events, droppedBatches: dropped },
    views: top(views, 30),
    clicks: top(clicks, 20),
    errors: top(errors, 10),
    network: top(nets, 10),
    slow: top(slows, 10),
    feedback,
  };

  // 120日より古い生の記録を消す（日ごとの集計 learn/daily/ は残す）
  let deletedDays = [];
  let quota = null;
  if (!localDir) {
    const limit = jst(new Date(Date.now() - KEEP_DAYS * 24 * 3600 * 1000));
    const days = (await list(RAW)).filter((o) => !o.id && /^\d{4}-\d{2}-\d{2}$/.test(o.name) && o.name < limit);
    for (const d of days) {
      const files = (await list(`${RAW}/${d.name}`)).filter((o) => o.id).map((o) => `${RAW}/${d.name}/${o.name}`);
      if (files.length) await remove(files);
      deletedDays.push(d.name);
    }
    const bytes = await bucketBytes();
    quota = {
      storageBytes: bytes,
      storageLimitBytes: FREE_STORAGE_BYTES,
      ratio: Math.round((bytes / FREE_STORAGE_BYTES) * 1000) / 1000,
      warn: bytes >= FREE_STORAGE_BYTES * 0.8,
      note: "写真置き場（genba-photos）全体の使用量。Supabase 無料枠 1GB に対する割合",
    };
  }

  const latest = {
    date,
    generatedAt: daily.generatedAt,
    signal,
    reasons,
    howToRead:
      "signal が false なら、AIはここで終わる（ほかのファイルは読まない）。true のときだけ learn/NIGHTLY.md の手順へ進み、relatedFiles に挙げたファイルだけを読む。",
    totals: daily.totals,
    feedback,
    topErrors: daily.errors.slice(0, 5),
    topNetwork: daily.network.slice(0, 5),
    topSlow: daily.slow.slice(0, 5),
    relatedFiles: signal ? relatedFiles : [],
    deletedRawDays: deletedDays,
    quota,
    notifyOwner: !!quota?.warn,
  };

  mkdirSync("learn/daily", { recursive: true });
  writeFileSync(`learn/daily/${date}.json`, JSON.stringify(daily, null, 2) + "\n");
  writeFileSync("learn/latest.json", JSON.stringify(latest, null, 2) + "\n");
  console.log(
    `集計 ${date}: まとめ ${batches.length}件・端末 ${devices.size}台・記録 ${events}件・ご意見 ${feedback.length}件（テスト ${feedback.length - realFeedback.length}件）・signal=${signal}`
  );
  if (reasons.length) console.log("理由:\n- " + reasons.join("\n- "));
  if (quota) console.log(`置き場の使用量 ${(quota.ratio * 100).toFixed(1)}%`);
  if (deletedDays.length) console.log(`古い記録を消した日: ${deletedDays.join(", ")}`);
}

if (!localDir && (!URL_ || !KEY)) {
  console.error("SUPABASE_URL と SUPABASE_KEY が必要です");
  process.exit(1);
}
if (existsSync("learn") === false) mkdirSync("learn");
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
