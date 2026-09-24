import { createClient } from '@supabase/supabase-js';
export const configured = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
export function supabase(token?: string) {
  if (!configured()) throw new Error('Supabase is not configured.');
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: typeof window !== 'undefined',
        autoRefreshToken: typeof window !== 'undefined',
      },
      ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
    },
  );
}
