"use client";

import { useAppData } from "@/hooks/useAppData";
import { ProductInfo, ProductRun } from "@/lib/types";
import { focusRing } from "@/lib/ui";

/**
 * 「販売の回」の切り替え。
 *
 * 同じ商品でも、年やバージョン（ハロウィン仕様など）で出し直すことがある。
 * 1回ごとに変わるのは 発売月・販売終了月・ビジュアル・準備タスク の4つだけで、
 * 品名・材料・価格・レシピ・紹介文は商品で1つ（ものは同じなので）。
 *
 * シートでもタスクでも同じ場所（上の帯）に出す。どの回を見ているかが常に分かるように。
 */
export function runView(app: ReturnType<typeof useAppData>, info: ProductInfo | null) {
  const id = app.selectedProduct?.id ?? "";
  const viewing = app.runTab && app.runTab.productId === id ? app.runTab.label : null;
  const past: ProductRun | null =
    (viewing && info?.runs.find((r) => r.label === viewing)) || null;
  return {
    /** 今の回の名前。空なら回で分けていない */
    currentLabel: info?.runLabel ?? "",
    /** 過去の回を見ているなら、その中身 */
    past,
    /** 過去の回を見ているか */
    viewingPast: !!past,
    /** いま見ている回の名前 */
    viewingLabel: past ? past.label : info?.runLabel ?? "",
  };
}

export default function RunTabs({
  app,
  info,
  onAddRun,
  onRenameRun,
}: {
  app: ReturnType<typeof useAppData>;
  info: ProductInfo;
  onAddRun: () => void;
  /** いま選んでいる回の名前を変える */
  onRenameRun: (label: string) => void;
}) {
  const id = app.selectedProduct?.id ?? "";
  const { currentLabel, viewingLabel } = runView(app, info);
  const hasRuns = !!currentLabel || info.runs.length > 0;

  const viewingCurrent = viewingLabel === currentLabel;

  /** いま選んでいる回を、今準備中の回に入れ替える。いまの回は控えに移るだけで消えない */
  const makeCurrent = () => {
    if (!id || viewingCurrent) return;
    const idx = info.runs.findIndex((r) => r.label === viewingLabel);
    const pick = info.runs[idx];
    if (!pick) return;
    if (!currentLabel) {
      alert("いまの回に名前がありません。先に「✎ 名前」で名前を付けてください。");
      return;
    }
    if (
      !confirm(
        "「" + pick.label + "」を今準備中にします。\n\n" +
          "いまの「" + currentLabel + "」は控えに移ります。中身（発売月・販売終了月・ビジュアル・チェック）は消えません。\n\n" +
          "よろしいですか？"
      )
    )
      return;
    const parked: ProductRun = {
      label: currentLabel,
      releaseDate: info.releaseDate,
      endDate: info.endDate,
      ongoing: info.ongoing,
      visuals: info.visualDownloads,
      taskState: app.getTaskState(id),
    };
    const nextRuns = info.runs.slice();
    nextRuns.splice(idx, 1, parked);
    app.updateInfo(id, {
      runLabel: pick.label,
      runs: nextRuns,
      releaseDate: pick.releaseDate,
      endDate: pick.endDate,
      ongoing: pick.ongoing,
      visualDownloads: pick.visuals,
    });
    app.setProductTasks(id, pick.taskState);
    app.setRunTab(null);
  };

  /**
   * いま選んでいる回を消す。
   *
   * 間違えて増やした回や、空のまま残った回を片づけるため。
   * 控えの回を消すと、その回の 発売月・販売終了月・ビジュアル・チェック だけがなくなる。
   * 今準備中の回を消すときは、代わりに今準備中にする回を選んでもらう。
   * 品名・材料・価格・レシピ・紹介文は、どちらの場合も消えない（商品で1つなので）。
   */
  const deleteRun = () => {
    if (!id) return;

    if (!viewingCurrent) {
      if (
        !confirm(
          "「" + viewingLabel + "」を消します。\n\n" +
            "この回の 発売月・販売終了月・ビジュアル・チェック の控えがなくなります。\n" +
            "品名・材料・価格・レシピ・紹介文は消えません。\n\n" +
            "元に戻せません。よろしいですか？"
        )
      )
        return;
      app.updateInfo(id, { runs: info.runs.filter((r) => r.label !== viewingLabel) });
      app.setRunTab(null);
      return;
    }

    if (info.runs.length === 0) {
      alert(
        "回が1つしかないので消せません。\n回で分けるのをやめるときは「✎ 名前」で名前を空にしてください。"
      );
      return;
    }
    const list = info.runs.map((r, i) => String(i + 1) + ". " + r.label).join("\n");
    const answer = prompt(
      "「" + viewingLabel + "」を消します。いま入っている 発売月・販売終了月・ビジュアル・チェック も一緒に消えます。\n\n" +
        "代わりに「今準備中」にする回の番号を入れてください。\n" + list,
      "1"
    );
    if (answer === null) return;
    const idx = Number(answer.trim()) - 1;
    const pick = info.runs[idx];
    if (!pick) {
      alert("番号が違います。");
      return;
    }
    if (
      !confirm(
        "「" + viewingLabel + "」を消して、「" + pick.label + "」を今準備中にします。\n\n元に戻せません。よろしいですか？"
      )
    )
      return;
    app.updateInfo(id, {
      runLabel: pick.label,
      runs: info.runs.filter((_, i) => i !== idx),
      releaseDate: pick.releaseDate,
      endDate: pick.endDate,
      ongoing: pick.ongoing,
      visualDownloads: pick.visuals,
    });
    app.setProductTasks(id, pick.taskState);
    app.setRunTab(null);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 print:hidden">
      {hasRuns && (
        <>
          <button
            type="button"
            onClick={() => app.setRunTab(null)}
            className={`rounded-lg border px-2.5 py-1 text-xs transition ${focusRing} ${
              viewingLabel === currentLabel
                ? "border-amber-600 bg-amber-600 font-medium text-white"
                : "border-stone-300 bg-white text-stone-600 hover:bg-stone-50"
            }`}
          >
            {currentLabel || "今の回"}
            <span
              className={`ml-1.5 ${
                viewingLabel === currentLabel ? "text-amber-100" : "text-stone-400"
              }`}
            >
              今準備中
            </span>
          </button>
          {info.runs.map((r) => (
            <button
              key={r.label}
              type="button"
              onClick={() => app.setRunTab({ productId: id, label: r.label })}
              className={`rounded-lg border px-2.5 py-1 text-xs transition ${focusRing} ${
                viewingLabel === r.label
                  ? "border-stone-600 bg-stone-600 font-medium text-white"
                  : "border-stone-300 bg-white text-stone-500 hover:bg-stone-50"
              }`}
            >
              {r.label}
            </button>
          ))}
        </>
      )}
      {hasRuns && (
        <button
          type="button"
          title="いま選んでいる回の名前を変える"
          onClick={() => onRenameRun(viewingLabel)}
          className={`rounded-lg border border-stone-300 bg-white px-2 py-1 text-xs text-stone-500 transition hover:border-amber-500 hover:text-amber-700 ${focusRing}`}
        >
          ✎ 名前
        </button>
      )}
      {hasRuns && !viewingCurrent && (
        <button
          type="button"
          title="いま選んでいる回を、今準備中の回にする"
          onClick={makeCurrent}
          className={"rounded-lg border border-stone-300 bg-white px-2 py-1 text-xs text-stone-500 transition hover:border-amber-500 hover:text-amber-700 " + focusRing}
        >
          ↺ 今準備中にする
        </button>
      )}
      {hasRuns && (
        <button
          type="button"
          title="いま選んでいる回を消す"
          onClick={deleteRun}
          className={"rounded-lg border border-stone-300 bg-white px-2 py-1 text-xs text-stone-500 transition hover:border-red-500 hover:text-red-700 " + focusRing}
        >
          🗑 この回を消す
        </button>
      )}
      <button
        type="button"
        onClick={onAddRun}
        className={`rounded-lg border border-dashed border-stone-300 px-2.5 py-1 text-xs text-stone-500 transition hover:border-amber-500 hover:text-amber-700 ${focusRing}`}
      >
        ＋ 回を追加
      </button>
    </div>
  );
}

/** 過去の回を見ているときの注意書き。シートでもタスクでも同じ文にする */
export function PastRunNotice({ label, current }: { label: string; current: string }) {
  return (
    <p className="rounded-lg border border-stone-300 bg-stone-200/60 px-3 py-2 text-xs text-stone-700">
      <span className="font-medium">{label}</span>{" "}
      は、いま準備中の回ではありません。見るだけで、直せません。
      直すときは「↺ 今準備中にする」を押してください。
      締め切りの数・進捗・入力率は「{current || "今の回"}」を見ています。
    </p>
  );
}
