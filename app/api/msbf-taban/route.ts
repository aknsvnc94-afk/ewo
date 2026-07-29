import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { readSession } from '@/lib/session';

export async function GET(req: NextRequest) {
  const session = readSession();
  if (!session) return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  if (!session.fabrikaId) return NextResponse.json({ error: 'Bu işlem için fabrika bağlamı gerekli' }, { status: 403 });

  const grup = req.nextUrl.searchParams.get('grup') || 'fompak_martur';

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('msbf_taban_degerleri')
    .select('taban_baski, taban_ariza, aciklama, guncelleme_tarihi')
    .eq('fabrika_id', session.fabrikaId)
    .eq('grup', grup)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ taban: data || { taban_baski: 0, taban_ariza: 0, aciklama: null } });
}

export async function POST(req: NextRequest) {
  const session = readSession();
  if (!session || session.rol !== 'admin') {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  }
  if (!session.fabrikaId) return NextResponse.json({ error: 'Bu işlem için fabrika bağlamı gerekli' }, { status: 403 });

  const { taban_baski, taban_ariza, aciklama, grup } = await req.json();

  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from('msbf_taban_degerleri')
    .upsert({
      fabrika_id: session.fabrikaId,
      grup: grup || 'fompak_martur',
      taban_baski: Number(taban_baski) || 0,
      taban_ariza: Number(taban_ariza) || 0,
      aciklama: aciklama || null,
      guncelleyen_id: session.id,
      guncelleme_tarihi: new Date().toISOString(),
    }, { onConflict: 'fabrika_id,grup' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
