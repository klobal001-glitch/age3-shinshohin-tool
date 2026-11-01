// 本番の画面から「【テスト】」のご意見を1件送り、お知らせが出ることを確かめる（learn-e2e.yml が使う）。
// 「受け取りました」の表示だけでは信じず、保管場所に本当に届いたかを返事の中身で確かめる。
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const APP = process.env.APP_URL || "https://age3-shinshohin-tool-theta.vercel.app/";
const MARK = `【テスト】通しの動作確認 ${new Date().toISOString().slice(0, 16).replace(/\D/g, "")}`;

// 公開が終わるまで待つ（最大10分）
for (let i = 0; i < 40; i++) {
  const r = await fetch(new URL("/learn-kit.js", APP), { cache: "no-store" }).catch(() => null);
  if (r && r.ok) break;
  console.log("学習キットがまだ公開されていません。15秒待ちます");
  await new Promise((s) => setTimeout(s, 15000));
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
let stored = null;
page.on("response", async (res) => {
  if (res.url().includes("/storage/v1/object/") && res.url().includes("/learn/raw/") && res.request().method() === "POST") {
    stored = { status: res.status(), body: await res.text().catch(() => ""), url: res.url() };
  }
});

await page.goto(APP, { waitUntil: "networkidle" });
await page.waitForFunction(() => !!document.querySelector("age3-learn-kit"), null, { timeout: 30000 });
await page.screenshot({ path: "e2e-1-home.png" });
const kit = page.locator("age3-learn-kit");
await kit.locator(".tab").click();
await kit.locator('button[role="tab"]', { hasText: "ご意見" }).click();
await kit.locator("button.pick.good").click();
await kit.locator("textarea").fill(MARK);
await kit.locator("button.send").click();
await kit.locator(".done").waitFor({ timeout: 15000 });
await page.screenshot({ path: "e2e-2-sent.png" });
if (!stored || stored.status !== 200 || !stored.body.includes("learn/raw/")) {
  console.error("保管場所に届いていません", stored);
  process.exit(1);
}
console.log("保管場所に届きました:", stored.body);

await page.waitForTimeout(2000);
await kit.locator(".tab").click();
await kit.locator('button[role="tab"]', { hasText: "お知らせ" }).click();
const text = await kit.locator(".panel").innerText();
await page.screenshot({ path: "e2e-3-updates.png" });
if (!/ご意見/.test(text) || !/\d+月\d+日/.test(text)) {
  console.error("お知らせが表示されません:", text);
  process.exit(1);
}
console.log("お知らせ:", text.replace(/\s+/g, " ").slice(0, 160));
if (errors.length) console.log("画面のエラー:", errors);
writeFileSync("e2e-mark.txt", MARK.replace(/\d/g, "#"));
await browser.close();
