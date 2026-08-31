/**
 * 画像の読み込みを順番待ちさせる仕組み。
 *
 * ビジュアル一覧は Dropbox の画像を数十枚まとめて取りに行くため、
 * 一度に投げるとリクエスト過多で弾かれ、「出たり出なかったり」になる。
 * 同時に走らせる数を絞って、順番に読み込ませる。
 */

/** 一度に読み込む枚数の上限 */
const MAX_CONCURRENT = 6;

let running = 0;
const waiting = new Set<() => void>();

function pump() {
  while (running < MAX_CONCURRENT && waiting.size > 0) {
    const next: () => void = waiting.values().next().value!;
    waiting.delete(next);
    running += 1;
    next();
  }
}

/**
 * 順番が来たら start() を呼ぶ。
 * 戻り値の関数で枠を返す（読み込み完了・失敗・中断のどれでも呼ぶこと）。
 * 二度呼んでも安全。
 */
export function requestImageSlot(start: () => void): () => void {
  let held = false;
  const run = () => {
    held = true;
    start();
  };

  waiting.add(run);
  pump();

  return () => {
    if (held) {
      held = false;
      running = Math.max(0, running - 1);
      pump();
    } else {
      waiting.delete(run);
    }
  };
}
