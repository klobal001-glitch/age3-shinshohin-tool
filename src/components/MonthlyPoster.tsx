"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Age3Logo from "@/components/Age3Logo";
import Icon from "@/components/Icon";
import MonthlyPhoto from "@/components/MonthlyPhoto";
import {
  MonthEntry,
  hasPrice,
  posterContinuedText,
  posterPeriodText,
  priceExceptions,
  priceText,
  shareMessageText,
  ymLabel,
} from "@/lib/monthly";
import {
  FOOTER_H,
  HEADER_H,
  PAPER_H,
  PAPER_W,
  POSTER_MAX,
  PosterItem,
  PhotoState,
  canvasToJpeg,
  canvasToJpegBlob,
  drawPoster,
  jpegToA4Pdf,
  loadPhoto,
  saveBlob,
  tierOf,
} from "@/lib/posterPdf";
import { toThumbnailUrl } from "@/lib/imageUrl";
import {
  fileToPosterPhoto,
  forgetPhoto,
  rememberPhoto,
  storedPhoto,
} from "@/lib/posterPhotoStore";
import { btn, muted } from "@/lib/ui";

export { POSTER_MAX };

/* ------------------------------------------------------------------ *
 * 店頭に貼る「その月に売っている商品」A4たて・1枚
 *
 * 紙に出すのは **お客さまに見せてよいものだけ**。
 * 商品の写真・正式な商品名・販売期間・価格の4つだけを出す。
 * 担当・社内の工程・原価・仕入・内部メモは一切入れない。
 *
 * 1枚に必ず収めるため、紙を 190mm × 273mm（A4から余白を引いた大きさ）に
 * 固定して、**件数ごとに決めた並べ方**で組む。文字を小さくして詰め込むのではなく、
 * 入る件数の上限（POSTER_MAX）を決めて、超えたら減らしてもらう。
 * ------------------------------------------------------------------ */

export default function MonthlyPoster({
  year,
  month,
  entries,
  onClose,
}: {
  year: number;
  month: number;
  entries: MonthEntry[];
  onClose: () => void;
}) {
  /* 画面が紙より狭いときは、紙を縮めて全体が見えるようにする（刷るときは等倍に戻す） */
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const measure = () => {
      const w = boxRef.current?.clientWidth ?? PAPER_W;
      setScale(Math.min(1, w / PAPER_W));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    document.body.classList.add("poster-open");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("poster-open");
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const over = entries.length > POSTER_MAX;
  const shown = entries.slice(0, POSTER_MAX);

  /* ── 写真が「PDFの中に入れられるか」を先に調べる ──
     画面に出すだけなら、どの置き場所の写真でも出せる。
     ところが PDF を作るには、写真の中身をいったん読み取る必要があり、
     置き場所が「よそから読んでよい」と返してくれないと読み取れない（CORS）。
     Dropbox の共有リンクはこれを返さないので、その写真はPDFに入れられない。
     読めない写真があるときは、ファイル保存を止めて理由を出し、印刷に回す。 */
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Record<string, PhotoState>>({});
  const [checking, setChecking] = useState(true);
  /* 手元から読み込んだ写真を覚え直したときに、調べ直すための数 */
  const [reload, setReload] = useState(0);
  const photoUrls = shown.map((e) => (e.image ? toThumbnailUrl(e.image.url) : "")).join("|");
  useEffect(() => {
    let cancelled = false;
    const list = photoUrls.split("|").filter(Boolean);
    Promise.all(
      list.map(async (u) => {
        /* この端末に覚えてある写真があれば、それを使う（PDFに入れられる） */
        const kept = storedPhoto(u);
        return [u, await loadPhoto(kept ?? u)] as const;
      })
    ).then((rows) => {
      if (cancelled) return;
      const map: Record<string, PhotoState> = {};
      for (const [u, st] of rows) map[u] = st;
      setPhotos(map);
      setChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, [photoUrls, reload]);

  /** 手元の写真を選んでもらい、この端末に覚える（データベースには書かない） */
  const [picking, setPicking] = useState<string | null>(null);
  const pickPhoto = async (url: string, file: File | null) => {
    if (!file) return;
    setPicking(url);
    setErr(null);
    try {
      const data = await fileToPosterPhoto(file);
      if (!rememberPhoto(url, data)) {
        setErr("この端末の空きが足りず、写真を覚えられませんでした。先にほかの写真を忘れてください。");
      }
      setReload((n) => n + 1);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "写真を読み込めませんでした");
    } finally {
      setPicking(null);
    }
  };

  const photoOf = (e: MonthEntry) => (e.image ? photos[toThumbnailUrl(e.image.url)] ?? null : null);
  /* PDFに入れられない写真を持つ商品 */
  const blocked = shown.filter((e) => {
    const st = photoOf(e);
    return !!st && !st.readable;
  });
  const blockedHosts = [...new Set(blocked.map((e) => photoOf(e)?.host ?? ""))].filter(Boolean);
  /* 画面には出るがPDFに入れられないもの と、そもそも写真が出ないもの は別ものなので分ける */
  const cantEmbed = blocked.filter((e) => photoOf(e)?.shown);
  const cantShow = blocked.filter((e) => !photoOf(e)?.shown);
  /* 手元から読み込んで、この端末に覚えてある写真を使っている商品 */
  const kept = shown.filter((e) => e.image && storedPhoto(toThumbnailUrl(e.image.url)));

  /* 画面に出す写真。手元から読み込んだものがあれば、PDFと同じものを出す
     （画面とPDFで違う絵が出ると、何が刷られるのか分からなくなる） */
  const displayImage = (e: MonthEntry) => {
    if (!e.image) return null;
    const keptUrl = storedPhoto(toThumbnailUrl(e.image.url));
    return keptUrl ? { url: keptUrl, key: e.image.key } : e.image;
  };

  /** 紙に載せる中身。PDFも画像も、必ずここから作る（中身がズレないように） */
  const buildItems = (): PosterItem[] =>
    shown.map((e) => ({
      name: e.product.name,
      period: posterPeriodText(e, year),
      price: priceText(e.fields),
      hasPrice: hasPrice(e.fields),
      exceptions: priceExceptions(e.fields),
      note: posterContinuedText(e, year),
      photo: photoOf(e),
    }));

  /** 英数字だけのファイル名。日本語を入れると端末によっては名前が落ちる */
  const fileBase = `Age3_${year}-${String(month).padStart(2, "0")}_shinshohin_A4`;

  /** 掲示をそのままPDFファイルとして保存する */
  const downloadPdf = async () => {
    setBusy(true);
    setErr(null);
    try {
      const items = buildItems();
      const canvas = await drawPoster(year, month, items, 300);
      const jpeg = await canvasToJpeg(canvas, 0.92);
      saveBlob(jpegToA4Pdf(jpeg, canvas.width, canvas.height), `${fileBase}.pdf`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "PDFを作れませんでした");
    } finally {
      setBusy(false);
    }
  };
  /* ------------------------------------------------------------------ *
   * LINEなどへ送る
   *
   * やること：紙と同じ絵を**画像ファイル**にして、短い案内文と一緒に渡す。
   * **送信はしない。**宛先を選んで送るのは、必ず人の操作。
   *
   * 端末によって、できることが違う：
   * - 画像を付けたまま共有できる端末（スマホのほとんど）
   *     … 共有先の一覧が出るので、そこで LINE を選んでもらう
   * - できない端末（パソコンのブラウザなど）
   *     … 「画像を保存」「文章をコピー」を出して、LINEに手で貼ってもらう
   * LINEのURLだけで画像を付けることはできないので、そこは当てにしない。
   * ------------------------------------------------------------------ */
  const [shareOpen, setShareOpen] = useState(false);
  /** 自分で直した文面。直していなければ null で、下書きがそのまま出る */
  const [editedMsg, setEditedMsg] = useState<string | null>(null);
  const [img, setImg] = useState<{ file: File; url: string } | null>(null);
  const [imgBusy, setImgBusy] = useState(false);
  const [canFiles, setCanFiles] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);

  /* 下書きの文面。月と、選ばれている商品の中身に合わせて作り直す。
     自分で直したあとは、そちらを優先して勝手に書き戻さない */
  const defaultMsg = shareMessageText(year, month, shown);
  const shareMsg = editedMsg ?? defaultMsg;

  /* 画面を閉じたら、作った画像の置き場所を片付ける */
  useEffect(() => () => {
    if (img) URL.revokeObjectURL(img.url);
  }, [img]);

  /** 送る画像を作る。紙と同じ中身を、送りやすい大きさ（200dpi）で */
  const openShare = async () => {
    setShareOpen(true);
    setShareNote(null);
    if (img || imgBusy) return;
    setImgBusy(true);
    setErr(null);
    try {
      const canvas = await drawPoster(year, month, buildItems(), 200);
      const blob = await canvasToJpegBlob(canvas, 0.9);
      const file = new File([blob], `${fileBase}.jpg`, { type: "image/jpeg" });
      setImg({ file, url: URL.createObjectURL(blob) });
      /* 画像を付けたまま共有できる端末かどうかは、作った画像そのもので確かめる */
      const nav = navigator as Navigator & {
        canShare?: (d: { files?: File[] }) => boolean;
      };
      setCanFiles(typeof nav.canShare === "function" && nav.canShare({ files: [file] }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "画像を作れませんでした");
    } finally {
      setImgBusy(false);
    }
  };

  /** 共有先の一覧を出す。選ぶのも送るのも、人の操作 */
  const shareNow = async () => {
    if (!img) return;
    setShareNote(null);
    try {
      await navigator.share({ files: [img.file], text: shareMsg });
      setShareNote("共有の画面を開きました。送信はご自身で行ってください。");
    } catch (e) {
      /* 「やめる」を押したときもここに来る。失敗したように見せない */
      const name = e instanceof Error ? e.name : "";
      if (name === "AbortError") setShareNote("共有をやめました。");
      else setShareNote("この端末では共有できませんでした。下の「画像を保存」「文章をコピー」をお使いください。");
    }
  };

  const copyMsg = async () => {
    try {
      await navigator.clipboard.writeText(shareMsg);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("下の文字をコピーしてください", shareMsg);
    }
  };

  const tier = tierOf(shown.length);
  const headerH = HEADER_H;
  const footerH = FOOTER_H;
  const gridH = PAPER_H - headerH - footerH;
  const cellH = gridH / tier.rows;
  const cellW = PAPER_W / tier.cols;

  /* 刷るときに後ろの画面を消すため、画面のいちばん外側に出す（globals.css の body.poster-open） */
  return createPortal(
    <div className="poster-sheet fixed inset-0 z-50 overflow-auto bg-stone-200 p-4 sm:p-6">
      {/* 操作のボタン。紙には出ない */}
      <div className="mx-auto mb-4 flex max-w-[760px] flex-wrap items-center gap-2 print:hidden">
        <button type="button" onClick={onClose} className={btn("secondary")}>
          <Icon name="close" className="h-4 w-4" />
          閉じる
        </button>
        <span className="text-sm font-semibold text-stone-700">
          {ymLabel(year, month)}の商品（店頭掲示用・A4たて1枚）
        </span>
        <button
          type="button"
          onClick={downloadPdf}
          disabled={shown.length === 0 || checking || busy || blocked.length > 0}
          className={btn("primary", "ml-auto")}
        >
          {busy ? "作成中…" : "A4のPDFをダウンロード"}
        </button>
        <button
          type="button"
          onClick={openShare}
          disabled={shown.length === 0 || checking || blocked.length > 0}
          className={btn("secondary")}
        >
          <Icon name="share" className="h-4 w-4" />
          LINEで送る
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          disabled={shown.length === 0}
          className={btn("secondary")}
        >
          印刷（PDFに保存）
        </button>
      </div>

      {/* ── LINEなどへ送る。送信はしない ── */}
      {shareOpen && (
        <div className="mx-auto mb-4 max-w-[760px] rounded-2xl bg-white p-4 shadow-sm print:hidden sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold tracking-tight text-stone-900">LINEで送る</h3>
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600 ring-1 ring-inset ring-stone-200">
              送信はしません
            </span>
            <button
              type="button"
              className={btn("quiet", "ml-auto")}
              onClick={() => setShareOpen(false)}
            >
              <Icon name="close" className="h-4 w-4" />
              閉じる
            </button>
          </div>
          <p className={`mt-1 ${muted}`}>
            この画面の掲示を<strong className="text-stone-700">画像</strong>にして、下の案内文と一緒に渡します。
            宛先を選んで送るのは、かならずご自身の操作です。
          </p>

          {/* スマホでは文章の幅を取りたいので、見本を上に置いて縦に並べる */}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:gap-4">
            <div className="flex shrink-0 items-center gap-3 sm:block">
              {imgBusy ? (
                <div className="flex h-[112px] w-[79px] items-center justify-center rounded-lg bg-stone-100 text-[11px] text-stone-500 sm:h-[150px] sm:w-[106px]">
                  作成中…
                </div>
              ) : img ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={img.url}
                  alt="送る画像"
                  className="h-[112px] w-[79px] rounded-lg bg-white object-contain shadow-sm ring-1 ring-stone-200 sm:h-[150px] sm:w-[106px]"
                />
              ) : (
                <div className="h-[112px] w-[79px] rounded-lg bg-stone-100 sm:h-[150px] sm:w-[106px]" />
              )}
              <p className="text-[11px] text-stone-400 sm:mt-1 sm:w-[106px] sm:text-center">
                送る画像
              </p>
            </div>

            <div className="min-w-0 flex-1">
              <label className="block text-xs font-medium text-stone-500">
                案内文（送る前に直せます）
              </label>
              <textarea
                value={shareMsg}
                onChange={(ev) => setEditedMsg(ev.target.value)}
                rows={5}
                className="mt-1 w-full rounded-lg border border-stone-300 bg-white p-3 text-sm leading-relaxed text-stone-800 shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/35"
              />
              {editedMsg !== null && editedMsg !== defaultMsg && (
                <button
                  type="button"
                  className={`${btn("quiet")} px-0 text-xs`}
                  onClick={() => setEditedMsg(null)}
                >
                  はじめの文に戻す
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {canFiles && (
              <button
                type="button"
                className={btn("primary")}
                disabled={!img || imgBusy}
                onClick={shareNow}
              >
                <Icon name="share" className="h-4 w-4" />
                画像と文章を共有する
              </button>
            )}
            <button
              type="button"
              className={btn("secondary")}
              disabled={!img || imgBusy}
              onClick={() => img && saveBlob(img.file, `${fileBase}.jpg`)}
            >
              画像を保存
            </button>
            <button type="button" className={btn("secondary")} onClick={copyMsg}>
              {copied ? "コピーしました" : "文章をコピー"}
            </button>
          </div>

          {shareNote && <p className="mt-2 text-sm text-stone-600">{shareNote}</p>}

          <div className="mt-4 rounded-xl bg-stone-50 p-3 text-xs leading-relaxed text-stone-600">
            {canFiles ? (
              <>
                <strong className="text-stone-800">「画像と文章を共有する」</strong>
                を押すと、送り先を選ぶ画面が出ます。そこで<strong className="text-stone-800">LINE</strong>
                を選び、宛先（リーダーグループなど）を選んでから、ご自身で送信してください。
                うまく出ないときは、下のやり方でも送れます。
              </>
            ) : (
              <>
                <strong className="text-stone-800">この端末（またはこのブラウザ）は、画像を付けたままの共有に対応していません。</strong>
                次の手順で送ってください。
                <ol className="mt-1.5 list-decimal space-y-0.5 pl-5">
                  <li>「画像を保存」を押して、画像を端末に保存する</li>
                  <li>「文章をコピー」を押す</li>
                  <li>LINEで宛先を開き、文章を貼り付ける</li>
                  <li>写真のボタンから、保存した画像を選んで送る</li>
                </ol>
              </>
            )}
            <p className="mt-2 text-stone-500">
              画像に入るのは、紙と同じ 写真・商品名・販売期間・公開できる価格 だけです。
              担当・原価・仕入・社内の準備状況・内部メモは入りません。
            </p>
          </div>
        </div>
      )}

      <div className="mx-auto mb-3 max-w-[760px] space-y-2 print:hidden">
        {checking ? (
          <p className={muted}>写真を確かめています…</p>
        ) : blocked.length === 0 ? (
          <p className={muted}>
            「A4のPDFをダウンロード」を押すと、
            <strong className="text-stone-700">PDFファイルがそのまま保存されます</strong>
            （A4たて・1ページ）。印刷したいときは「印刷（PDFに保存）」から、
            ブラウザの印刷画面でも同じものを出せます。
          </p>
        ) : (
          <div className="rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
            <p className="font-semibold">
              いまのままでは、PDFファイルとしての保存ができません（写真{blocked.length}件）
            </p>
            {cantEmbed.length > 0 && (
              <p className="mt-1">
                下の写真は<strong>画面にはちゃんと出ています</strong>。
                ただ、写真の置き場所（{blockedHosts.join("・")}）が
                「よそのページから中身を読み取ってよい」と返してくれないため、
                <strong>PDFの中に入れられません</strong>。この2つは別のことです。
              </p>
            )}
            {cantShow.length > 0 && (
              <p className="mt-1">
                下の写真は<strong>そもそも読み込めません</strong>
                （リンクが切れているか、いまネットにつながっていない可能性があります）。
              </p>
            )}
            <p className="mt-1">
              同じ写真を一度だけ手元から読み込めば、PDFに入れられるようになります。
              <strong>読み込んだ写真は、このパソコンの中だけに覚えます。</strong>
              商品データベースにも、ビジュアルのリンクにも書き込みません。
              （写真は、ビジュアルの置き場所からふだんどおりダウンロードしたものを選んでください）
            </p>
            <ul className="mt-2 space-y-1.5">
              {blocked.map((e) => {
                const url = e.image ? toThumbnailUrl(e.image.url) : "";
                return (
                  <li
                    key={e.product.id + e.runLabel}
                    className="flex flex-wrap items-center gap-2 rounded-lg bg-white/70 px-2 py-1.5"
                  >
                    <span className="min-w-0 flex-1 font-medium">{e.product.name}</span>
                    <label className={`${btn("secondary")} cursor-pointer`}>
                      {picking === url ? "読み込み中…" : "写真を選ぶ"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(ev) => {
                          const f = ev.target.files?.[0] ?? null;
                          ev.target.value = "";
                          pickPhoto(url, f);
                        }}
                      />
                    </label>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2">
              写真を読み込まずに保存したいときは、
              <strong>「印刷（PDFに保存）」→ 送信先を「PDFに保存」</strong>
              を使ってください。こちらは写真の入ったA4たて1枚のPDFになります。
            </p>
          </div>
        )}
        {kept.length > 0 && (
          <div className="rounded-xl bg-stone-100 p-3 text-xs leading-relaxed text-stone-600">
            <span>このパソコンに覚えている写真：</span>
            {kept.map((e) => {
              const url = e.image ? toThumbnailUrl(e.image.url) : "";
              return (
                <span
                  key={e.product.id + e.runLabel}
                  className="ml-2 inline-flex items-center gap-1"
                >
                  {e.product.name}
                  <button
                    type="button"
                    className="underline hover:text-stone-900"
                    onClick={() => {
                      forgetPhoto(url);
                      setReload((n) => n + 1);
                    }}
                  >
                    忘れる
                  </button>
                </span>
              );
            })}
          </div>
        )}
        {err && <p className="text-xs font-medium text-red-600">{err}</p>}
        {over && (
          <p className="text-xs font-semibold text-red-600">
            {entries.length}件 選ばれています。1枚に載せられるのは{POSTER_MAX}件までなので、
            先頭の{POSTER_MAX}件だけを出しています。前の画面でチェックを減らしてください。
          </p>
        )}
      </div>

      {/* 紙そのもの。大きさは固定。画面では横幅に合わせて縮めて見せる */}
      <div ref={boxRef} className="mx-auto w-full max-w-[760px]">
        <div className="poster-scale mx-auto" style={{ width: PAPER_W, zoom: scale }}>
        {/* 見た目はアプリの画面と同じ決めごと（globals.css の @theme / lib/ui.ts）で組む。
            紙でも画面でも同じ色・同じ書体・同じ角丸・同じ余白になるようにしている */}
        <div
          className="poster-paper bg-canvas text-stone-900 shadow-lg print:shadow-none"
          style={{ width: PAPER_W, height: PAPER_H }}
        >
          {/* 見出し：小さな見出し → 大きな題（ホーム画面と同じ組み方） */}
          <div style={{ height: headerH }} className="relative flex flex-col justify-start">
            <div className="flex items-center gap-3 pt-2">
              <Age3Logo className="h-[22px] w-auto text-stone-900" />
              <span className="text-[15px] font-bold tracking-wide text-stone-900">
                商品のご案内
              </span>
            </div>
            <div className="mt-4 flex items-baseline tracking-tight">
              <span className="text-[40px] font-semibold leading-none">{year}年</span>
              <span className="ml-1 text-[56px] font-semibold leading-none">{month}月</span>
              <span className="ml-3.5 text-[24px] font-semibold leading-none tracking-normal text-stone-500">
                の商品
              </span>
            </div>
            {/* アクセント（ember）はこの1か所だけ */}
            <div className="absolute inset-x-0 flex items-end" style={{ bottom: 11 }}>
              <span className="h-[3px] w-14 shrink-0 bg-amber-700" />
              <span className="h-px flex-1 bg-stone-200" />
            </div>
          </div>

          {/* 商品 */}
          {shown.length === 0 ? (
            <div
              style={{ height: gridH }}
              className="flex items-center justify-center text-[20px] text-stone-400"
            >
              掲示する商品が選ばれていません
            </div>
          ) : (
            <div style={{ height: gridH }} className="flex flex-wrap content-start">
              {shown.map((e, i) => {
                const ex = priceExceptions(e.fields);
                /* 継続のお知らせ → 店舗別の価格 の順で、小さな印を縦に積む */
                const notes = [
                  ...(posterContinuedText(e, year) ? [posterContinuedText(e, year) as string] : []),
                  ...(ex.length ? [ex.join("／")] : []),
                ];
                const tall = tier.shape === "tall";
                const innerH = cellH - 14 - 36;
                const boxH = tall ? innerH * tier.img : innerH;
                const boxW = tall ? undefined : Math.min(innerH, cellW * tier.img);
                return (
                  <div key={i} className="poster-cell p-[7px]" style={{ width: cellW, height: cellH }}>
                    <div
                      className={`flex h-full w-full rounded-2xl border border-stone-200 bg-white p-[18px] shadow-sm ${
                        tall ? "flex-col items-center" : "items-center gap-4"
                      }`}
                    >
                      <MonthlyPhoto
                        image={displayImage(e)}
                        style={{ height: boxH, width: boxW ?? "100%" }}
                        className="shrink-0 rounded-lg bg-stone-50 object-contain p-1"
                        fontSize={13}
                        big
                      />
                      <div
                        className={`min-w-0 flex-1 ${tall ? "mt-4 text-center" : ""}`}
                      >
                        <div
                          style={{ fontSize: tier.name, lineHeight: 1.25 }}
                          className="font-bold tracking-tight"
                        >
                          {e.product.name}
                        </div>
                        <div
                          style={{ fontSize: tier.period, lineHeight: 1.5 }}
                          className="mt-1.5 text-stone-500"
                        >
                          {posterPeriodText(e, year)}
                        </div>
                        <div
                          style={{ fontSize: tier.price, lineHeight: 1.35 }}
                          className="mt-1.5 font-bold tabular-nums"
                        >
                          {priceText(e.fields)}
                          {hasPrice(e.fields) && (
                            <span
                              style={{ fontSize: tier.period }}
                              className="ml-1.5 font-normal text-stone-500"
                            >
                              （税込）
                            </span>
                          )}
                        </div>
                        {notes.length > 0 && (
                          <div className={`mt-2 flex flex-col gap-1 ${tall ? "items-center" : "items-start"}`}>
                            {notes.map((n) => (
                              <span
                                key={n}
                                style={{ fontSize: Math.max(12, tier.period - 1) }}
                                className="inline-flex items-center rounded-full bg-stone-100 px-2.5 py-1 font-medium text-stone-600 ring-1 ring-inset ring-stone-200"
                              >
                                {n}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div
            style={{ height: footerH }}
            className="flex items-end justify-between border-t border-stone-200 pt-1 text-xs"
          >
            <span className="text-[14px] font-semibold text-stone-900">
              ※販売期間・価格は変更になる場合があります。
            </span>
            <span className="text-stone-400">Age.3</span>
          </div>
        </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
