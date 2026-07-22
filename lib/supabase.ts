import { createClient } from '@supabase/supabase-js';

// DİKKAT: Bu client SERVICE ROLE key kullanır, RLS'i bypass eder.
// Sadece app/api/** route dosyaları içinde (sunucu tarafında) import edilmelidir.
// İstemci (browser) tarafına asla import edilmemelidir.
export function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
