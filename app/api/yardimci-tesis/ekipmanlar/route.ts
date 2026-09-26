import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { readSession } from '@/lib/session';

export async function GET() {
  const session = readSession();
  if (!session) return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  if (!session.fabrikaId) return NextResponse.json({ error: 'Bu işlem için fabrika bağlamı gerekli' }, { status: 403 });

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('yardimci_tesis_ekipmanlar')
    .select(`
      id, ad, tur, kontrol_edilebilir,
      okuma_register_adresi, okuma_register_tipi, okuma_veri_tipi, birim, carpan,
      yazma_register_adresi, yazma_register_tipi,
      setpoint_register_adresi, setpoint_min, setpoint_max,
      aktif, siralama,
      cihaz:cihaz_id ( id, ad, aktif, son_gorulme )
    `)
    .eq('fabrika_id', session.fabrikaId)
    .order('siralama');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ekipmanlar: data });
}

export async function POST(req: NextRequest) {
  const session = readSession();
  if (!session || (session.rol !== 'admin' && session.rol !== 'superadmin')) {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  }
  if (!session.fabrikaId) return NextResponse.json({ error: 'Bu işlem için fabrika bağlamı gerekli' }, { status: 403 });

  const body = await req.json();
  const { ad, tur, cihaz_id, kontrol_edilebilir } = body;
  if (!ad || !ad.toString().trim()) return NextResponse.json({ error: 'Ekipman adı gerekli' }, { status: 400 });
  if (!['sicaklik', 'pompa', 'kompresor', 'chiller', 'diger'].includes(tur)) {
    return NextResponse.json({ error: 'Geçersiz ekipman türü' }, { status: 400 });
  }
  if (!cihaz_id) return NextResponse.json({ error: 'Bağlı olduğu cihaz seçilmeli' }, { status: 400 });

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('yardimci_tesis_ekipmanlar')
    .insert({
      fabrika_id: session.fabrikaId,
      cihaz_id,
      ad: ad.toString().trim(),
      tur,
      kontrol_edilebilir: !!kontrol_edilebilir,
      okuma_register_adresi: body.okuma_register_adresi ?? null,
      okuma_register_tipi: body.okuma_register_tipi ?? null,
      okuma_veri_tipi: body.okuma_veri_tipi ?? 'int16',
      birim: body.birim ?? null,
      carpan: body.carpan ?? 1,
      yazma_register_adresi: body.yazma_register_adresi ?? null,
      yazma_register_tipi: body.yazma_register_tipi ?? null,
      setpoint_register_adresi: body.setpoint_register_adresi ?? null,
      setpoint_min: body.setpoint_min ?? null,
      setpoint_max: body.setpoint_max ?? null,
      siralama: body.siralama ?? 0,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, id: data.id });
}
