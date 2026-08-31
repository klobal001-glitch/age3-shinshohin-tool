import { DeadlineRule, Milestone, TaskGroup } from "./types";

// 準備タスクのテンプレート（グループ A-1, G-1〜G-5）。
// 締切は「発売月から○か月前のD日」というシンプルな規則で計算されています
// （G-5のみ販売終了月の月末）。

const monthsBefore = (months: number, day: number): DeadlineRule => ({
  type: "monthsBefore",
  months,
  day,
});

export const TASK_GROUPS: TaskGroup[] = [
  {
    id: "a1",
    icon: "🧪",
    title: "A-1　開発",
    milestones: [
      {
        id: "a1-m1",
        label: "前々月28日まで",
        rule: monthsBefore(2, 28),
        tasks: [
          { id: "shooting", label: "商品撮影" },
          { id: "video_shoot", label: "作り方動画撮影 →デザイン班に共有" },
          { id: "material_check", label: "材料確認（注文ロット・価格・納期・業者）" },
          { id: "cost_calc", label: "原価計算・使用量（g数）" },
          { id: "material_image", label: "材料画像・使用量（g数）→デザイン班に共有" },
          {
            id: "no_alcohol_pork",
            label: "NOアルコール／NOポーク確認 → 全体共有",
            linkedField: "noAlcoholPork",
          },
          {
            id: "price_tokyo",
            label: "販売価格（銀座・原宿・浅草・飛騨高山／税込）（幸平さんOK）",
            linkedField: "priceTokyo",
          },
          {
            id: "price_tokyo_uber",
            label: "└ 販売価格（Uber／税込）（幸平さんOK）",
            linkedField: "priceTokyoUber",
          },
          {
            id: "price_kama",
            label: "販売価格（嘉麻／税込）（幸平さんOK）",
            linkedField: "priceKama",
          },
          {
            id: "price_kama_uber",
            label: "└ 販売価格（Uber／税込）（幸平さんOK）",
            linkedField: "priceKamaUber",
          },
          { id: "stock_setting", label: "在庫設定" },
          { id: "recipe_create", label: "レシピ作成" },
          { id: "final_decision", label: "商品名・画像・価格(東京価格と嘉麻価格)・期間 最終決定 → リーダーへ共有" },
          { id: "hida_recipe", label: "飛騨高山にレシピを公開、仕入れを促す。" },
        ],
      },
    ],
  },
  {
    id: "g1",
    icon: "📸",
    title: "G-1　ビジュアル制作",
    milestones: [
      {
        id: "g1-m1",
        label: "前々月4日まで",
        rule: monthsBefore(2, 4),
        tasks: [{ id: "shooting_fix", label: "商品撮影 → 補正" }],
      },
      {
        id: "g1-m2",
        label: "前々月9日まで",
        rule: monthsBefore(2, 9),
        tasks: [
          { id: "yt_edit", label: "作り方YouTube 編集" },
          { id: "yt_post", label: "作り方YouTube 投稿🔗自動入力欄へ →" },
          { id: "get_material_image", label: "材料画像・使用量（g数）をもらう" },
          { id: "material_sheet", label: "材料スプレッドシート作成(のちのち消します)" },
          { id: "yt_share_stores", label: "作り方YouTubeを各店の業務連絡に投稿" },
        ],
      },
      {
        id: "g1-m3",
        label: "前々月15日まで",
        rule: monthsBefore(2, 15),
        tasks: [
          { id: "ig_feed", label: "Instagram フィード投稿画像🔗自動入力欄へ →" },
          { id: "ig_caption", label: "Instagram 投稿文章🔗自動入力欄へ →" },
          { id: "ig_story", label: "Instagram ストーリーズ投稿画像🔗自動入力欄へ →" },
          {
            id: "poster_ginza",
            label: "銀座ポスター（外A3）",
            children: [
              { id: "make", label: "制作" },
              { id: "submit", label: "入稿" },
            ],
          },
          {
            id: "poster_asakusa_a1",
            label: "ポスター A1（浅草）🔗自動入力欄へ →",
            children: [
              { id: "make", label: "制作" },
              { id: "submit", label: "入稿" },
            ],
          },
          {
            id: "poster_asakusa_b2",
            label: "浅草ポスター（外B2）",
            children: [
              { id: "make", label: "制作" },
              { id: "submit", label: "入稿" },
            ],
          },
          {
            id: "poster_harajuku",
            label: "原宿ポスター（外A2）",
            children: [
              { id: "make", label: "制作" },
              { id: "submit", label: "入稿" },
            ],
          },
          {
            id: "poster_hida",
            label: "飛騨高山ポスター（A1）",
            children: [
              { id: "make", label: "制作" },
              { id: "submit", label: "入稿" },
            ],
          },
          {
            id: "panel_kama",
            label: "嘉麻パネル🔗自動入力欄へ →",
            children: [
              { id: "make", label: "制作" },
              { id: "submit", label: "入稿" },
            ],
          },
          {
            id: "poster_kama",
            label: "嘉麻ポスター（A2・日本語）",
            children: [
              { id: "make", label: "制作" },
              { id: "submit", label: "入稿" },
            ],
          },
          { id: "laminate_kanto", label: "レジ用ラミネートA5 関東＋飛騨高山用🔗自動入力欄へ →" },
          { id: "laminate_kama", label: "レジ用ラミネートA5 嘉麻用🔗自動入力欄へ →" },
          { id: "airregi_image", label: "エアレジ 商品画像🔗自動入力欄へ →" },
          { id: "x_caption", label: "X（旧Twitter）文章🔗自動入力欄へ →" },
          { id: "threads_caption", label: "Threads 文章🔗自動入力欄へ →" },
          { id: "ec_slider_pc", label: "ECスライダー PC🔗自動入力欄へ →" },
          { id: "ec_slider_sp", label: "ECスライダー スマホ🔗自動入力欄へ →" },
          { id: "ginza_showcase", label: "銀座ショーケース 目隠し 制作" },
        ],
      },
      {
        id: "g1-m4",
        label: "前月15日まで",
        rule: monthsBefore(1, 15),
        tasks: [
          { id: "signage_v", label: "サイネージ 縦🔗自動入力欄へ →" },
          { id: "signage_h", label: "サイネージ 横🔗自動入力欄へ →" },
          { id: "signage_usb", label: "サイネージデータ USBに書き出し → 発送" },
        ],
      },
      {
        id: "g1-m5",
        label: "前月20日まで",
        rule: monthsBefore(1, 20),
        tasks: [
          {
            id: "menu_fold",
            label: "二つ折り手元メニュー🔗自動入力欄へ →",
            children: [
              { id: "make", label: "制作" },
              { id: "submit", label: "入稿" },
            ],
          },
          {
            id: "flyer",
            label: "各店チラシ🔗自動入力欄へ →",
            children: [
              { id: "make", label: "制作" },
              { id: "submit", label: "入稿" },
            ],
          },
          { id: "laminate_ship", label: "レジ用ラミネートA5 → 発送（5店舗）" },
          { id: "uber_image", label: "Uber Eats 商品画像🔗自動入力欄へ →" },
          { id: "confirm_office", label: "ビジュアル（レジ・ウーバー・業者用）＋文章を全て事務に投げたか確認" },
          { id: "confirm_kama_staff", label: "ビジュアル（Instagram・X・スレッズ）＋文章を全て嘉麻スタッフに投げたか確認" },
        ],
      },
    ],
  },
  {
    id: "g2",
    icon: "📰",
    title: "G-2　PR TIMES",
    milestones: [
      {
        id: "g2-m1",
        label: "前月20日まで",
        rule: monthsBefore(1, 20),
        tasks: [
          { id: "press_draft", label: "プレスリリース作成" },
          { id: "press_review", label: "原稿確認・修正" },
          { id: "press_final", label: "配信内容 最終確認（オーナーOK確認）" },
        ],
      },
      {
        id: "g2-m2",
        label: "前月24日まで",
        rule: monthsBefore(1, 24),
        note: "※10:20／発売一週間前の平日に設定",
        tasks: [
          { id: "press_release", label: "配信" },
          { id: "press_url", label: "🔗 記事URL取得" },
          { id: "share_leader", label: "リーダーグループに共有" },
          { id: "shopify_slider", label: "Shopify トップスライダー画像 UP（web／スマホ）" },
          { id: "ig_note_share", label: "FC含む全店の業務連絡に Instagram投稿用文章を共有（ノートに記載）" },
          { id: "notify_leader", label: "↑の記載をリーダーに連絡" },
          { id: "post_order_notice", label: "1日からの投稿順を全店に告知。(飛騨高山などFCも)" },
        ],
      },
    ],
  },
  {
    id: "g4",
    icon: "🌏",
    title: "G-4　海外フランチャイズへ提案",
    milestones: [
      {
        id: "g4-m1",
        label: "前月26日まで",
        rule: monthsBefore(1, 26),
        note: "※投稿2日後",
        tasks: [{ id: "share_overseas", label: "新商品情報共有" }],
      },
    ],
  },
  {
    id: "g5",
    icon: "🧹",
    title: "G-5　販売終了後",
    milestones: [
      {
        id: "g5-m1",
        label: "月末",
        rule: { type: "endOfMonth", useEndDate: true },
        tasks: [{ id: "ec_slider_cleanup", label: "EC スライダー整理" }],
      },
    ],
  },
];

export function countLeaves(milestone: Milestone): number {
  return milestone.tasks.reduce(
    (sum, t) => sum + (t.children && t.children.length > 0 ? t.children.length : 1),
    0
  );
}

export function countGroupLeaves(group: TaskGroup): number {
  return group.milestones.reduce((sum, m) => sum + countLeaves(m), 0);
}
