// 通し確認の集計に、さっき送った【テスト】のご意見が載ったか。テストのご意見で signal が立っていないか。
import { readFileSync } from "node:fs";
const latest = JSON.parse(readFileSync("learn/latest.json", "utf8"));
const mark = readFileSync("e2e-mark.txt", "utf8").trim();
const hit = latest.feedback.find((f) => f.comment === mark);
if (!hit) {
  console.error("集計にご意見が載っていません", mark, latest.feedback);
  process.exit(1);
}
if (!hit.test) {
  console.error("テストの印が付いていません", hit);
  process.exit(1);
}
const realFb = latest.feedback.filter((f) => !f.test).length;
console.log(`載りました: ${hit.kind}「${hit.comment}」／ signal=${latest.signal}／テスト以外のご意見 ${realFb}件`);
if (latest.reasons.some((r) => r.includes("テスト"))) {
  console.error("テストのご意見で signal が立っています", latest.reasons);
  process.exit(1);
}
if (latest.signal) {
  console.error("signal が true です（テスト以外の理由）:", latest.reasons);
  process.exit(1);
}
console.log("signal は false のままです");
