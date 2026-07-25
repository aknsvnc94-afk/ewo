import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { readSession } from '@/lib/session';

export async function POST(req: NextRequest) {
  const session = readSession();
  if (!session || session.rol !== 'admin') {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  }

  const { is_emri_idler, personel_id } = await req.json();
  if (!Array.isArray(is_emri_idler) || is_emri_idler.length === 0 || !personel_id) {
    return NextResponse.json({ error: 'is_emri_idler ve personel_id gerekli' }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from('is_emirleri')
    .update({ atanan_personel_id: personel_id, atama_tarihi: new Date().toISOString() })
    .in('id', is_emri_idler);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, atanan_sayi: is_emri_idler.length });
}
