import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { readSession } from '@/lib/session';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = readSession();
  if (!session || (session.rol !== 'admin' && session.rol !== 'superadmin')) {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  }
  if (!session.fabrikaId) return NextResponse.json({ error: 'Bu işlem için fabrika bağlamı gerekli' }, { status: 403 });

  const body = await req.json();
  const izinliAlanlar = ['ad', 'baglanti_tipi', 'baglanti_ayarlari', 'modbus_slave_id', 'aktif'];
  const guncelleme: Record<string, any> = {};
  for (const alan of izinliAlanlar) if (alan in body) guncelleme[alan] = body[alan];

  if (Object.keys(guncelleme).length === 0) {
    return NextResponse.json({ error: 'Güncellenecek alan gönderilmedi' }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('yardimci_tesis_cihazlari')
    .update(guncelleme)
    .eq('id', params.id)
    .eq('fabrika_id', session.fabrikaId)
    .select('id, ad, baglanti_tipi, baglanti_ayarlari, modbus_slave_id, aktif')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, cihaz: data });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = readSession();
  if (!session || (session.rol !== 'admin' && session.rol !== 'superadmin')) {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  }
  if (!session.fabrikaId) return NextResponse.json({ error: 'Bu işlem için fabrika bağlamı gerekli' }, { status: 403 });

  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from('yardimci_tesis_cihazlari')
    .delete()
    .eq('id', params.id)
    .eq('fabrika_id', session.fabrikaId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
