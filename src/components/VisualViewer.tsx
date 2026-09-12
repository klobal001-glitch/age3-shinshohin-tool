"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GENRE_LABELS } from "@/lib/types";
import { toThumbnailUrl } from "@/lib/imageUrl";
import { CardImage } from "@/lib/visualThumb";
import { SALE_STATUS_LABEL, SaleStatus, isInactive } from "@/lib/saleStatus";
import Icon from "@/components/Icon";
import { btn, focusRing } from "@/lib/ui";

/**
 * ビジュアルの全画面ビューア。
 *
 * 写真アプリと同じ操作にしてある：画像を押すと全画面で開き、
 * 左右にスワイプ（PCは ← → キー）で次の商品、下にスワイプか Esc で閉じる。
 * それまでは「画像を大きく見るには商品情報シートを開くしかない」状態だったので、
 * 見比べるのに商品を行ったり来たりする必要があった。
 *
 * 中身の見た目（並べ方と動かし方）は写真アプリの作法に合わせているだけで、
 * どこかのサービスのロゴや意匠は使っていない。
 */

export interface ViewerItem {
    id: string;
    name: string;
    genre: keyof typeof GENRE_LABELS | null;
    releaseDate: string;
    card: CardImage | null;
    done: number;
    total: number;
    status: SaleStatus;
}

/** 全画面で見せる画像。表示用URLがだめなら貼られたURLを試す */
function FullImage({ card, alt }: { card: CardImage | null; alt: string }) {
    const candidates = useMemo(() => {
        const url = card?.url ?? "";
        if (!url) return [];
        return [toThumbnailUrl(url), url].filter((u, i, all) => u && all.indexOf(u) === i);
    }, [card]);
    const [i, setI] = useState(0);

    /* 商品が変わったら最初の候補から試し直す */
    const key = card?.url ?? "";
    const lastKey = useRef(key);
    if (lastKey.current !== key) {
        lastKey.current = key;
        if (i !== 0) setI(0);
    }

    if (candidates.length === 0 || i >= candidates.length) {
        return (
            <div className="flex h-full w-full items-center justify-center text-sm text-white/50">
                画像が登録されていません
            </div>
        );
    }
    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            key={candidates[i]}
            src={candidates[i]}
            alt={alt}
            className="max-h-full max-w-full object-contain"
            referrerPolicy="no-referrer"
            onError={() => setI((v) => v + 1)}
        />
    );
}

export default function VisualViewer({
    items,
    index,
    onIndexChange,
    onClose,
    onOpenSheet,
}: {
    items: ViewerItem[];
    index: number;
    onIndexChange: (i: number) => void;
    onClose: () => void;
    onOpenSheet: (id: string) => void;
}) {
    const item = items[index];

    const go = useCallback(
        (step: number) => {
            const next = index + step;
            if (next < 0 || next >= items.length) return;
            onIndexChange(next);
        },
        [index, items.length, onIndexChange]
    );

    /* 開いている間は後ろの画面を動かさない */
    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = prev;
        };
    }, []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
            if (e.key === "ArrowRight") go(1);
            if (e.key === "ArrowLeft") go(-1);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [go, onClose]);

    /* 指の動き。横に払えば次の商品、下に払えば閉じる */
    const start = useRef<{ x: number; y: number } | null>(null);
    const onTouchStart = (e: React.TouchEvent) => {
        const t = e.touches[0];
        start.current = { x: t.clientX, y: t.clientY };
    };
    const onTouchEnd = (e: React.TouchEvent) => {
        const s = start.current;
        start.current = null;
        if (!s) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - s.x;
        const dy = t.clientY - s.y;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
            go(dx < 0 ? 1 : -1);
        } else if (dy > 90 && Math.abs(dy) > Math.abs(dx)) {
            onClose();
        }
    };

    if (!item) return null;

    const pct = item.total ? Math.round((item.done / item.total) * 100) : 0;

    return (
        <div
            className="fixed inset-0 z-50 flex flex-col bg-stone-950/95 backdrop-blur-sm"
            role="dialog"
            aria-label={`${item.name} のビジュアル`}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
        >
            {/* 上の帯：何枚目か・閉じる */}
            <div className="flex shrink-0 items-center gap-3 px-3 pb-2 pt-3 text-white">
                <span className="text-xs tabular-nums text-white/60">
                    {index + 1} / {items.length}
                </span>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="閉じる"
                    className={`ml-auto inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white ${focusRing}`}
                >
                    <Icon name="close" className="h-5 w-5" />
                </button>
            </div>

            {/* 画像。まわりの黒いところを押しても閉じる */}
            <div
                className="flex min-h-0 flex-1 items-center justify-center px-3"
                onClick={(e) => {
                    if (e.target === e.currentTarget) onClose();
                }}
            >
                <FullImage card={item.card} alt={item.name} />
            </div>

            {/* PCでは左右にボタンを出す（スマホはスワイプ） */}
            {index > 0 && (
                <button
                    type="button"
                    onClick={() => go(-1)}
                    aria-label="前の商品"
                    className={`absolute left-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:flex ${focusRing}`}
                >
                    <Icon name="chevronRight" className="h-5 w-5 rotate-180" />
                </button>
            )}
            {index < items.length - 1 && (
                <button
                    type="button"
                    onClick={() => go(1)}
                    aria-label="次の商品"
                    className={`absolute right-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:flex ${focusRing}`}
                >
                    <Icon name="chevronRight" className="h-5 w-5" />
                </button>
            )}

            {/* 下の帯：商品の情報とシートへの入口 */}
            <div className="pb-safe shrink-0 border-t border-white/10 bg-black/40 px-4 py-3">
                <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <span className="truncate text-base font-semibold text-white">
                                {item.name}
                            </span>
                            {isInactive(item.status) && (
                                <span className="shrink-0 rounded-full bg-white/15 px-2 py-0.5 text-xs text-white/80">
                                    {SALE_STATUS_LABEL[item.status]}
                                </span>
                            )}
                        </div>
                        <div className="mt-0.5 text-xs text-white/60">
                            {item.genre ? GENRE_LABELS[item.genre] : "ジャンル未設定"}
                            <span className="mx-1.5 text-white/30">/</span>
                            <span className="tabular-nums">
                                {item.releaseDate ? item.releaseDate.replaceAll("-", "/") : "発売日未設定"}
                            </span>
                            <span className="mx-1.5 text-white/30">/</span>
                            <span className="tabular-nums">
                                ビジュアル {item.done}/{item.total}（{pct}%）
                            </span>
                        </div>
                    </div>
                    <button
                        className={`${btn("primary")} w-full shrink-0 sm:w-auto`}
                        onClick={() => onOpenSheet(item.id)}
                    >
                        情報シートを開く
                        <Icon name="arrowRight" className="h-4 w-4" />
                    </button>
                </div>
                <p className="mx-auto mt-2 max-w-3xl text-xs text-white/40 sm:hidden">
                    左右にスワイプで次の商品／下にスワイプで閉じる
                </p>
            </div>
        </div>
    );
}
