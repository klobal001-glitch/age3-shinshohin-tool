/**
 * 画面まわり（タブ・ボタン・見出し）で使う線のアイコン。
 *
 * 以前は 🏠 📝 ✅ のような絵文字を使っていたが、絵文字は端末ごとに絵柄も色も
 * 変わるうえ、大きさが揃わない。ここは線だけの図形にして、太さ・大きさ・色を
 * 文字に合わせて揃える（色は currentColor を継承する）。
 *
 * 商品や章立てに付けている絵文字は「その中身の目印」なので、そのまま残している。
 */

export type IconName =
  | "home"
  | "sheet"
  | "task"
  | "gallery"
  | "help"
  | "search"
  | "plus"
  | "chevronDown"
  | "chevronRight"
  | "arrowRight"
  | "close"
  | "external"
  | "link"
  | "calendar"
  | "alert"
  | "check";

const PATHS: Record<IconName, React.ReactNode> = {
  home: (
    <>
      <path d="M3.2 10.4 12 3.4l8.8 7" />
      <path d="M5.6 9.2V20a.8.8 0 0 0 .8.8h11.2a.8.8 0 0 0 .8-.8V9.2" />
      <path d="M9.8 20.8v-6h4.4v6" />
    </>
  ),
  sheet: (
    <>
      <path d="M13.5 3.2H6.8a1.6 1.6 0 0 0-1.6 1.6v14.4a1.6 1.6 0 0 0 1.6 1.6h10.4a1.6 1.6 0 0 0 1.6-1.6V8.2z" />
      <path d="M13.5 3.2v5h5.3" />
      <path d="M8.6 13h6.8M8.6 16.6h4.6" />
    </>
  ),
  task: (
    <>
      <path d="M20.6 11.3V12a8.6 8.6 0 1 1-5.1-7.9" />
      <path d="M20.8 5.4 12 14.2l-2.6-2.6" />
    </>
  ),
  gallery: (
    <>
      <rect x="3.2" y="4.6" width="17.6" height="14.8" rx="2.2" />
      <circle cx="8.6" cy="9.8" r="1.6" />
      <path d="M20.8 15.4 16 10.8l-8 8" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="8.8" />
      <path d="M9.6 9.6a2.5 2.5 0 0 1 4.9.6c0 1.7-2.5 2.1-2.5 3.8" />
      <path d="M12 17.4h.01" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.6" />
      <path d="m20 20-4.3-4.3" />
    </>
  ),
  plus: <path d="M12 5.2v13.6M5.2 12h13.6" />,
  chevronDown: <path d="m6.5 9.5 5.5 5.5 5.5-5.5" />,
  chevronRight: <path d="m9.5 6.5 5.5 5.5-5.5 5.5" />,
  arrowRight: (
    <>
      <path d="M4.4 12h15.2" />
      <path d="m13.6 6 6 6-6 6" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  external: (
    <>
      <path d="M14.4 4.4h5.2v5.2" />
      <path d="m19.6 4.4-8 8" />
      <path d="M18 14v4.8a1.6 1.6 0 0 1-1.6 1.6H5.6A1.6 1.6 0 0 1 4 18.8V8a1.6 1.6 0 0 1 1.6-1.6h4.8" />
    </>
  ),
  link: (
    <>
      <path d="M10.2 13.8a3.8 3.8 0 0 0 5.7.4l2.4-2.4a3.8 3.8 0 0 0-5.4-5.4l-1.4 1.3" />
      <path d="M13.8 10.2a3.8 3.8 0 0 0-5.7-.4l-2.4 2.4a3.8 3.8 0 0 0 5.4 5.4l1.4-1.3" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.6" y="5.4" width="16.8" height="15" rx="2.2" />
      <path d="M3.6 10.2h16.8M8.4 3.4v4M15.6 3.4v4" />
    </>
  ),
  alert: (
    <>
      <circle cx="12" cy="12" r="8.8" />
      <path d="M12 7.8v4.8M12 16.4h.01" />
    </>
  ),
  check: <path d="m4.8 12.6 4.8 4.8 9.6-10.8" />,
};

export default function Icon({
  name,
  className = "h-4 w-4",
  strokeWidth = 1.7,
}: {
  name: IconName;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`shrink-0 ${className}`}
    >
      {PATHS[name]}
    </svg>
  );
}
