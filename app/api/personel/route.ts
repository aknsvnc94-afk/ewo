import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { readSession } from '@/lib/session';

export async function GET() {
  const session = readSession();
  if (!session || session.rol !== 'admin') {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  }
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('personel')
    .select('id, ad_soyad, rol, aktif')
    .eq('aktif', true)
    .order('ad_soyad');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ personel: data });
}
