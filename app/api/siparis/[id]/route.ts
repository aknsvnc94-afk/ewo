import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { readSession } from '@/lib/session';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = readSession();
  if (!session) return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });

  const supabase = supabaseAdmin();
  const { data: siparis, error: siparisErr } = await supabase
    .from('siparisler')
    .select('id, dosya_adi, pdf_url, ham_metin, talep_no, tarih, bolum, kisi, yuklenme_tarihi, yukleyen:yukleyen_id ( ad_soyad )')
    .eq('id', params.id)
    .single();

  if (siparisErr || !siparis) return NextResponse.json({ error: 'Sipariş bulunamadı' }, { status: 404 });

  const { data: kalemler, error: kalemErr } = await supabase
    .from('siparis_kalemleri')
    .select('id, sira, satir_metni, stok_kodu, miktar, teslim_tarihi, alindi, alinma_tarihi, alan:alan_personel_id ( ad_soyad )')
    .eq('siparis_id', params.id)
    .order('sira', { ascending: true });

  if (kalemErr) return NextResponse.json({ error: kalemErr.message }, { status: 500 });

  return NextResponse.json({ siparis, kalemler });
}
