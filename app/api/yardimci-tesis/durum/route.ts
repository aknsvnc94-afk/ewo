import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { readSession } from '@/lib/session';

// Köprü servisinin bir cihazı "çevrimiçi" saymak için beklenen maksimum
// sessizlik süresi. Bu süreden uzun süredir son_gorulme güncellenmemişse
// arayüzde "Bağlantı Yok" gösterilir. Köprünün tarama aralığından
// (poll interval) belirgin şekilde büyük tutulmalı.
const CEVRIMICI_ESIK_SANIYE = 120;

export async function GET() {
  const session = readSession();
  if (!session) return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  if (!session.fabrikaId) return NextResponse.json({ error: 'Bu işlem için fabrika bağlamı gerekli' }, { status: 403 });

  const supabase = supabaseAdmin();

  const { data: ekipmanlar, error: ekipmanErr } = await supabase
    .from('yardimci_tesis_ekipmanlar')
    .select(`
      id, ad, tur, kontrol_edilebilir, birim, setpoint_min, setpoint_max,
      cihaz:cihaz_id ( id, ad, aktif, son_gorulme )
    `)
    .eq('fabrika_id', session.fabrikaId)
    .eq('aktif', true)
    .order('siralama');

  if (ekipmanErr) return NextResponse.json({ error: ekipmanErr.message }, { status: 500 });

  const { data: sonOlcumler, error: olcumErr } = await supabase
    .from('yardimci_tesis_son_olcumler')
    .select('ekipman_id, deger, durum, olcum_zamani')
    .eq('fabrika_id', session.fabrikaId);

  if (olcumErr) return NextResponse.json({ error: olcumErr.message }, { status: 500 });

  const olcumMap = new Map((sonOlcumler || []).map((o) => [o.ekipman_id, o]));
  const simdi = Date.now();

  const sonuc = (ekipmanlar || []).map((e: any) => {
    const olcum = olcumMap.get(e.id) || null;
    const sonGorulme = e.cihaz?.son_gorulme ? new Date(e.cihaz.son_gorulme).getTime() : null;
    const cevrimici = !!(e.cihaz?.aktif && sonGorulme && (simdi - sonGorulme) / 1000 < CEVRIMICI_ESIK_SANIYE);
    return { ...e, son_olcum: olcum, cevrimici };
  });

  return NextResponse.json({ ekipmanlar: sonuc });
}
