import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Giriş ekranındaki fabrika seçim listesi için — girişten önce çağrıldığından
// auth gerektirmez (sadece fabrika adı/kodu döner, hassas veri yok).
export async function GET() {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('fabrikalar')
    .select('id, ad, kod')
    .eq('aktif', true)
    .order('ad');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ fabrikalar: data });
}
