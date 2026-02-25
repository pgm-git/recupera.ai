import { createClient } from '@supabase/supabase-js';

// Chaves fornecidas pelo usuário
const supabaseUrl = (window as any)._env_?.SUPABASE_URL || 'https://epqtoaluztqldddskorj.supabase.co';
const supabaseKey = (window as any)._env_?.SUPABASE_ANON_KEY || 'sb_publishable_Szo7xCIdztMap1TYOvF60w_5XcZEIVr';

export const supabase = createClient(supabaseUrl, supabaseKey);

// Helper para verificar se o supabase está configurado
export const isSupabaseConfigured = () => {
  return supabaseUrl !== 'https://placeholder.supabase.co';
};