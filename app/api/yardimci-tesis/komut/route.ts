import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { readSession } from '@/lib/session';

// Bu uç, GERÇEK ekipmana (kompresör, chiller, pompa) etki edecek bir komutu
// kuyruğa yazar. Güvenlik nedeniyle şimdilik yalnızca admin/superadmin
// kullanabilir — personel bu modülü görüntüleyebilir ama komut gönderemez.
export async function POST(req: NextRequest) {
  const session = readSession();
  if (!session || (session.rol !== 'admin' && session.rol !== 'superadmin')) {
    return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 401 });
  }
  if (!session.fabrikaId) return NextResponse.json({ error: 'Bu işlem için fabrika bağlamı gerekli' }, { status: 403 });

  const { ekipman_id, komut_tipi, istenen_deger } = await req.json();
  if (!ekipman_id || !['ac_kapat', 'setpoint'].includes(komut_tipi) || typeof istenen_deger !== 'number') {
    return NextResponse.json({ error: 'Geçersiz komut' }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  const { data: ekipman, error: ekipmanErr } = await supabase
    .from('yardimci_tesis_ekipmanlar')
    .select('id, ad, kontrol_edilebilir, setpoint_min, setpoint_max, cihaz:cihaz_id ( aktif )')
    .eq('id', ekipman_id)
    .eq('fabrika_id', session.fabrikaId)
    .single();

  if (ekipmanErr || !ekipman) return NextResponse.json({ error: 'Ekipman bulunamadı' }, { status: 404 });
  if (!ekipman.kontrol_edilebilir) {
    return NextResponse.json({ error: `"${ekipman.ad}" için uzaktan kontrol tanımlı değil` }, { status: 400 });
  }
  if (!(ekipman as any).cihaz?.aktif) {
    return NextResponse.json({ error: 'Bu ekipmanın bağlı olduğu cihaz pasif durumda' }, { status: 400 });
  }
  if (komut_tipi === 'ac_kapat' && ![0, 1].includes(istenen_deger)) {
    return NextResponse.json({ error: 'Aç/kapat komutu 0 veya 1 olmalı' }, { status: 400 });
  }
  if (komut_tipi === 'setpoint') {
    if (ekipman.setpoint_min !== null && istenen_deger < ekipman.setpoint_min) {
      return NextResponse.json({ error: `Değer minimum ${ekipman.setpoint_min} olmalı` }, { status: 400 });
    }
    if (ekipman.setpoint_max !== null && istenen_deger > ekipman.setpoint_max) {
      return NextResponse.json({ error: `Değer maksimum ${ekipman.setpoint_max} olmalı` }, { status: 400 });
    }
  }

  const { data, error } = await supabase
    .from('yardimci_tesis_komutlar')
    .insert({
      fabrika_id: session.fabrikaId,
      ekipman_id,
      komut_tipi,
      istenen_deger,
      isteyen_personel_id: session.id,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}

// Son komutları (denetim kaydı) listeler.
export async function GET(req: NextRequest) {
  const session = readSession();
  if (!session) return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  if (!session.fabrikaId) return NextResponse.json({ error: 'Bu işlem için fabrika bağlamı gerekli' }, { status: 403 });

  const ekipmanId = req.nextUrl.searchParams.get('ekipman_id');

  const supabase = supabaseAdmin();
  let sorgu = supabase
    .from('yardimci_tesis_komutlar')
    .select(`
      id, komut_tipi, istenen_deger, durum, hata_mesaji, olusturma_tarihi, uygulanma_tarihi,
      ekipman:ekipman_id ( ad ),
      isteyen:isteyen_personel_id ( ad_soyad )
    `)
    .eq('fabrika_id', session.fabrikaId)
    .order('olusturma_tarihi', { ascending: false })
    .limit(50);

  if (ekipmanId) sorgu = sorgu.eq('ekipman_id', ekipmanId);

  const { data, error } = await sorgu;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ komutlar: data });
}
