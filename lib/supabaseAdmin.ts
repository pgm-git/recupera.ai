import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!_client) {
      const url = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';
      _client = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }
    return (_client as any)[prop];
  },
});
