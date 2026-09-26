import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { readSession } from '@/lib/session';

export async function GET() {
  const session = readSession();
  if (!session) return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  if (!session.fabrikaId) return NextResponse.json({ error: 'Bu işlem için fabrika bağlamı gerekli' }, { status: 403 });

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('yardimci_tesis_cihazlari')
    .select('id, ad, baglanti_tipi, baglanti_ayarlari, modbus_slave_id, aktif, son_gorulme')
    .eq('fabrika_id', session.fabrikaId)
    .order('ad');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ cihazlar: data });
}

export async function POST(req: NextRequest) {
  const session = readSession();
  if (!session || (session.rol !== 'admin' && session.rol !== 'superadmin')) {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  }
  if (!session.fabrikaId) return NextResponse.json({ error: 'Bu işlem için fabrika bağlamı gerekli' }, { status: 403 });

  const { ad, baglanti_tipi, baglanti_ayarlari, modbus_slave_id } = await req.json();
  if (!ad || !ad.toString().trim()) {
    return NextResponse.json({ error: 'Cihaz adı gerekli' }, { status: 400 });
  }
  if (!['rs485', 'wifi_tcp'].includes(baglanti_tipi)) {
    return NextResponse.json({ error: 'Geçersiz bağlantı tipi' }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('yardimci_tesis_cihazlari')
    .insert({
      fabrika_id: session.fabrikaId,
      ad: ad.toString().trim(),
      baglanti_tipi,
      baglanti_ayarlari: baglanti_ayarlari || {},
      modbus_slave_id: modbus_slave_id || 1,
    })
    .select('id, ad, baglanti_tipi, baglanti_ayarlari, modbus_slave_id, aktif')
    .single();

  if (error) {
    const mesaj = error.message.includes('duplicate') || error.message.includes('unique')
      ? 'Bu isimde bir cihaz zaten ekli'
      : error.message;
    return NextResponse.json({ error: mesaj }, { status: 400 });
  }
  return NextResponse.json({ ok: true, cihaz: data });
}
