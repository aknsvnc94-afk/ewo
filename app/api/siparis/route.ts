import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { readSession } from '@/lib/session';

export async function GET() {
  const session = readSession();
  if (!session) return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  if (!session.fabrikaId) return NextResponse.json({ error: 'Bu işlem için fabrika bağlamı gerekli' }, { status: 403 });

  const supabase = supabaseAdmin();
  const { data: siparisler, error } = await supabase
    .from('siparisler')
    .select('id, dosya_adi, pdf_url, talep_no, tarih, bolum, kisi, yuklenme_tarihi, yukleyen:yukleyen_id ( ad_soyad ), departman_onayi, satinalma_onayi, talep_onayi')
    .eq('fabrika_id', session.fabrikaId)
    .order('yuklenme_tarihi', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Her sipariş için kalem sayısı / alınan sayısı özeti
  const { data: kalemler } = await supabase
    .from('siparis_kalemleri')
    .select('siparis_id, alindi')
    .eq('fabrika_id', session.fabrikaId);

  const ozet: Record<string, { toplam: number; alinan: number }> = {};
  (kalemler || []).forEach((k) => {
    if (!ozet[k.siparis_id]) ozet[k.siparis_id] = { toplam: 0, alinan: 0 };
    ozet[k.siparis_id].toplam += 1;
    if (k.alindi) ozet[k.siparis_id].alinan += 1;
  });

  const zenginlestirilmis = (siparisler || []).map((s) => ({
    ...s,
    toplam_kalem: ozet[s.id]?.toplam || 0,
    alinan_kalem: ozet[s.id]?.alinan || 0,
  }));

  return NextResponse.json({ siparisler: zenginlestirilmis });
}
