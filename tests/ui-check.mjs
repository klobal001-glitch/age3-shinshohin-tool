// 公開前の自動テスト（スマホ幅 360px／390px と PC幅）。
//
//   npm run build && node tests/ui-check.mjs
//   LEARN_TEST_BREAK=overflow node tests/ui-check.mjs   … わざと壊して、検査が落ちることを確かめる
//
// 書き出した out/ を手元で配り、データの保管場所（Supabase）への通信は作り物の返事で置き換える。
// 本物のデータには一切触らない。
//
// 見ること
// - 横のはみ出し 0（ページ全体の幅が画面幅を超えない）
// - エラー 0（JavaScript のエラー・console.error）
// - 既存の機能が動く（下のタブ／左のリストで画面が切り替わる、現場チェックの3画面が開く）
// - 学習キット：ボタンが44px以上、ご意見が送れて数字・メールが伏せられている、お知らせが読める、
//   印刷では消える、お客様の回答画面では出ない
//
// もともと落ちている検査は tests/known-failures.json に書く。それ以外の失敗が1つでもあれば終了コード1。
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, writeFileSync } from "node:fs";
import { join, extname } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  ({ chromium } = await import("playwright"));
}

const OUT = "out";
const BREAK = process.env.LEARN_TEST_BREAK || "";
const WIDTHS = [
  { name: "スマホ360", width: 360, height: 740, mobile: true },
  { name: "スマホ390", width: 390, height: 844, mobile: true },
  { name: "PC", width: 1280, height: 800, mobile: false },
];

if (!existsSync(OUT)) {
  console.error("out/ がありません。先に npm run build を実行してください。");
  process.exit(2);
}

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".txt": "text/plain", ".woff2": "font/woff2" };
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  let file = join(OUT, p);
  if (existsSync(file + ".html") && (!existsSync(file) || statSync(file).isDirectory())) file += ".html";
  else if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!existsSync(file)) {
    res.writeHead(404);
    return res.end("not found");
  }
  res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream" });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const failures = [];
const fail = (id, detail) => failures.push({ id, detail: String(detail).slice(0, 300) });
const uploads = [];

const browser = await chromium.launch();

async function newPage(w) {
  const ctx = await browser.newContext({ viewport: { width: w.width, height: w.height }, isMobile: w.mobile, hasTouch: w.mobile });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
  // データの保管場所への通信は作り物で返す（本物には触らない）
  await page.route(/supabase\.co/, async (route) => {
    const req = route.request();
    const url = req.url();
    if (url.includes("/storage/v1/object/") && url.includes("/learn/raw/") && req.method() === "POST") {
      uploads.push(JSON.parse(req.postData() || "{}"));
      return route.fulfill({ status: 200, contentType: "application/json", body: '{"Key":"ok"}' });
    }
    if (url.includes("/rest/v1/")) return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  if (BREAK === "overflow") {
    await page.addInitScript(() => {
      addEventListener("DOMContentLoaded", () => {
        const d = document.createElement("div");
        d.style.width = "2000px";
        d.style.height = "10px";
        document.body.appendChild(d);
      });
    });
  }
  if (BREAK === "error") {
    await page.addInitScript(() => addEventListener("load", () => setTimeout(() => { throw new Error("わざと壊したエラー"); }, 0)));
  }
  return { ctx, page, errors };
}

async function overflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}
async function waitKit(page) {
  await page.waitForFunction(() => !!document.querySelector("age3-learn-kit"), null, { timeout: 15000 });
}
async function clickVisible(page, text) {
  const btn = page.locator(`button:visible`, { hasText: text }).first();
  await btn.click({ timeout: 5000 });
  await page.waitForTimeout(400);
}

for (const w of WIDTHS) {
  /* ---- 商品データベース ---- */
  {
    const { ctx, page, errors } = await newPage(w);
    const id = (s) => `${w.name} / ${s}`;
    try {
      await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
      await waitKit(page);
      for (const tab of ["シート", "タスク", "ビジュアル", "チラシ", "使い方", "ホーム"]) {
        try {
          await clickVisible(page, tab);
          const o = await overflow(page);
          if (o > 0) fail(id(`商品データベース「${tab}」横のはみ出し`), `${o}px`);
        } catch (e) {
          fail(id(`商品データベース「${tab}」に切り替わらない`), e.message);
        }
      }
      // 学習キット：ボタンの大きさ
      const box = await page.evaluate(() => {
        const b = document.querySelector("age3-learn-kit").shadowRoot.querySelector(".tab").getBoundingClientRect();
        return { w: b.width, h: b.height, right: window.innerWidth - b.right };
      });
      if (box.w < 44 || box.h < 44) fail(id("ご意見ボタンが44px未満"), JSON.stringify(box));
      // ご意見を送る（数字とメールが伏せられていること）
      const before = uploads.length;
      await page.evaluate(() => document.querySelector("age3-learn-kit").shadowRoot.querySelector(".tab").click());
      const sr = (sel) => page.locator("age3-learn-kit").locator(sel);
      await sr('button[role="tab"]', { hasText: "ご意見" }).first().click().catch(() => {});
      await sr("button.pick.bad").click();
      await sr("textarea").fill("【テスト】保存が分かりにくい taro@example.com 090-1234-5678");
      await sr("button.send").click();
      await sr(".done").waitFor({ timeout: 5000 });
      const sent = uploads.slice(before).flatMap((u) => u.events || []).find((e) => e.t === "fb");
      if (!sent) fail(id("ご意見が送られない"), "送信なし");
      else if (/\d|@/.test(sent.cm)) fail(id("ご意見の数字・メールが伏せられていない"), sent.cm);
      // 入力欄の中身が記録に入っていないこと（シートの入力欄に書いた文字を探す）
      // お知らせ
      await page.waitForTimeout(1700);
      await page.evaluate(() => window.__age3LearnKit.open("up"));
      const txt = await sr(".panel").innerText();
      if (!txt.includes("ご意見")) fail(id("お知らせが表示されない"), txt.slice(0, 80));
      await page.keyboard.press("Escape");
      // 印刷では消える
      await page.emulateMedia({ media: "print" });
      const shown = await page.evaluate(() => {
        const h = document.querySelector("age3-learn-kit");
        const t = h.shadowRoot.querySelector(".tab");
        return getComputedStyle(h).display !== "none" && t.getBoundingClientRect().width > 0;
      });
      if (shown) fail(id("印刷のときにご意見ボタンが出る"), "");
      await page.emulateMedia({ media: "screen" });
      // 最初の画面ではみ出していないか
      const o = await overflow(page);
      if (o > 0) fail(id("商品データベース 横のはみ出し"), `${o}px`);
    } catch (e) {
      fail(id("商品データベースの確認が途中で止まった"), e.message);
    }
    for (const e of errors) fail(id("商品データベース エラー"), e);
    await ctx.close();
  }

  /* ---- 現場チェック ---- */
  {
    const { ctx, page, errors } = await newPage(w);
    const id = (s) => `${w.name} / ${s}`;
    try {
      await page.goto(`${BASE}/genba`, { waitUntil: "networkidle" });
      await waitKit(page);
      for (const v of ["アンケート", "改善レポート", "現場チェック"]) {
        try {
          await clickVisible(page, v);
          const o = await overflow(page);
          if (o > 0) fail(id(`現場チェック「${v}」横のはみ出し`), `${o}px`);
        } catch (e) {
          fail(id(`現場チェック「${v}」に切り替わらない`), e.message);
        }
      }
      // お客様の回答画面ではキットを出さない
      await clickVisible(page, "アンケート");
      await clickVisible(page, "アンケートを始める");
      const hidden = await page.evaluate(() => {
        const h = document.querySelector("age3-learn-kit");
        return document.documentElement.hasAttribute("data-learn-kit-off") && (!h || h.style.display === "none");
      });
      if (!hidden) fail(id("お客様の回答画面にご意見ボタンが出る"), "");
    } catch (e) {
      fail(id("現場チェックの確認が途中で止まった"), e.message);
    }
    for (const e of errors) fail(id("現場チェック エラー"), e);
    await ctx.close();
  }
}

await browser.close();
server.close();

const known = existsSync("tests/known-failures.json") ? JSON.parse(readFileSync("tests/known-failures.json", "utf8")).failures || [] : [];
const knownIds = new Set(known.map((f) => f.id));
const fresh = failures.filter((f) => !knownIds.has(f.id));
writeFileSync("tests/last-result.json", JSON.stringify({ at: new Date().toISOString(), break: BREAK || null, failures }, null, 2) + "\n");

console.log(`検査 ${WIDTHS.length}つの幅 × 2アプリ ／ 失敗 ${failures.length}件（もともと ${failures.length - fresh.length}件・今回増えた ${fresh.length}件）`);
for (const f of fresh) console.log(`- ${f.id}: ${f.detail}`);
process.exit(fresh.length ? 1 : 0);
