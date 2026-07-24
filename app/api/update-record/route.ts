import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { readSession } from '@/lib/session';

const ALLOWED_STATUS = ['Beklemede', 'Devam Ediyor', 'Onay Bekliyor', 'Tamamlandı', 'İptal'];

// Personelin ve adminin güncelleyebileceği alanlar (EWO formu - F13-31 + temel kayıt bilgileri)
const GUNCELLENEBILIR_ALANLAR = [
  'aksiyon', 'hedef_tarih', 'tamamlanma_durumu', 'kok_neden_turu',
  'ariza_turu', 'arizanin_tanimi', 'direk_sebep_cozum',
  'zaman_ariza_baslangic', 'zaman_mudahale_baslangic', 'zaman_teshis_baslangic',
  'zaman_tamir_baslangic', 'zaman_yedek_parca_bekleme', 'zaman_montaj_baslangic',
  'zaman_makine_baslatilma', 'zaman_uretim_baslangic',
  'direk_sebep', 'neden_1', 'neden_2', 'neden_3', 'neden_4', 'neden_5',
  'onlemler_kok_neden', 'onlemler_sifir_ariza',
  'analiz_sorumlusu', 'sonuc',
  // Temel kayıt bilgileri (admin düzeltme için)
  'tezgah', 'kategori', 'durus_adi', 'kalip_kodu', 'vardiya', 'aciklama',
];

export async function PATCH(req: NextRequest) {
  const session = readSession();
  if (!session) return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });

  const body = await req.json();
  const { id } = body;
  if (!id) return NextResponse.json({ error: 'id gerekli' }, { status: 400 });

  if (body.tamamlanma_durumu && !ALLOWED_STATUS.includes(body.tamamlanma_durumu)) {
    return NextResponse.json({ error: 'Geçersiz durum değeri' }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  // Personel sadece kendine atanan kaydı güncelleyebilir
  if (session.rol === 'personel') {
    const { data: kayit } = await supabase
      .from('ariza_kayitlari')
      .select('atanan_personel_id')
      .eq('id', id)
      .single();
    if (!kayit || kayit.atanan_personel_id !== session.id) {
      return NextResponse.json({ error: 'Bu kayıt size atanmamış' }, { status: 403 });
    }
  }

  const updatePayload: Record<string, any> = {};
  for (const alan of GUNCELLENEBILIR_ALANLAR) {
    if (body[alan] !== undefined) updatePayload[alan] = body[alan];
  }

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json({ error: 'Güncellenecek alan bulunamadı' }, { status: 400 });
  }

  const { error } = await supabase.from('ariza_kayitlari').update(updatePayload).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
