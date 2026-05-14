import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

let serviceClient: ReturnType<typeof createClient<Database>> | null = null;

function requireServerEnv(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(
      `${name} 환경변수가 없습니다. 서버에서 사용할 Supabase 설정을 .env.local에 추가해 주세요.`,
    );
  }

  return value;
}

export function getServiceSupabaseClient() {
  if (!serviceClient) {
    const supabaseUrl = requireServerEnv(
      "NEXT_PUBLIC_SUPABASE_URL",
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    );
    const serviceRoleKey = requireServerEnv(
      "SUPABASE_SERVICE_ROLE_KEY",
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    );

    serviceClient = createClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return serviceClient;
}
