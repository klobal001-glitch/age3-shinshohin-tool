import { createClient } from "@supabase/supabase-js";

// NEXT_PUBLIC_* な値はビルド時にクライアントバンドルへ埋め込まれます。
// anon/publishable キーは RLS ポリシーで保護されている前提の公開キーです。
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (!supabaseUrl || !supabaseAnonKey) {
  // ビルド時に環境変数が渡されていない場合はここで気づけるようにする
  // （本番ビルドでは GitHub Actions の env で必ず設定される想定）
  console.warn("Supabase の環境変数が設定されていません。共有データ機能は動作しません。");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
