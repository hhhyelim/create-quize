import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

function requirePublicEnv(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(
      `${name} 환경변수가 없습니다. Supabase 공개 설정을 .env.local에 추가해 주세요.`,
    );
  }

  return value;
}

export function createBrowserSupabaseClient() {
  const supabaseUrl = requirePublicEnv(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
  const supabaseAnonKey = requirePublicEnv(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  return createClient<Database>(supabaseUrl, supabaseAnonKey);
}
