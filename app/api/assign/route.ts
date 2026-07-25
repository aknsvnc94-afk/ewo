import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { readSession } from '@/lib/session';

export async function POST(req: NextRequest) {
  const session = readSession();
  if (!session || session.rol !== 'admin') {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  }
  if (!session.fabrikaId) return NextResponse.json({ error: 'Bu işlem için fabrika bağlamı gerekli' }, { status: 403 });

  const { kayit_idler, personel_id } = await req.json();
  if (!Array.isArray(kayit_idler) || kayit_idler.length === 0 || !personel_id) {
    return NextResponse.json({ error: 'kayit_idler ve personel_id gerekli' }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  const { data: hedefPersonel } = await supabase
    .from('personel').select('fabrika_id').eq('id', personel_id).single();
  if (!hedefPersonel || hedefPersonel.fabrika_id !== session.fabrikaId) {
    return NextResponse.json({ error: 'Personel bu fabrikaya ait değil' }, { status: 400 });
  }

  const { error } = await supabase
    .from('ariza_kayitlari')
    .update({ atanan_personel_id: personel_id, atama_tarihi: new Date().toISOString() })
    .in('id', kayit_idler)
    .eq('fabrika_id', session.fabrikaId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, atanan_sayi: kayit_idler.length });
}
