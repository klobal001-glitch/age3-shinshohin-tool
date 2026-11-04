"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { useAppData } from "@/hooks/useAppData";
import { btn } from "@/lib/ui";

const OverseasDeckView=dynamic(()=>import("./OverseasDeckView"),{loading:()=> <p className="p-4 text-sm text-stone-500">資料制作を準備しています…</p>});

export default function OverseasTaskAction({app}:{app:ReturnType<typeof useAppData>}) {
  const [open,setOpen]=useState(false);
  return <div className="space-y-3 border-t border-stone-100 p-3 print:hidden">
    <button type="button" className={btn("primary")} aria-expanded={open} onClick={()=>setOpen(v=>!v)}>{open?"資料制作を閉じる":"海外FC資料制作"}</button>
    {!open&&<p className="text-xs text-stone-500">上で登録した情報・画像をそのまま使い、日本語・英語・タイ語・ベトナム語・中国語の資料を作ります。不足分だけ追加してください。</p>}
    {open&&<OverseasDeckView app={app} quick/>}
  </div>;
}
