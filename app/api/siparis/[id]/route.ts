import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { readSession } from '@/lib/session';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = readSession();
  if (!session) return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  if (!session.fabrikaId) return NextResponse.json({ error: 'Bu işlem için fabrika bağlamı gerekli' }, { status: 403 });

  const supabase = supabaseAdmin();
  const { data: siparis, error: siparisErr } = await supabase
    .from('siparisler')
    .select('id, dosya_adi, pdf_url, ham_metin, talep_no, tarih, bolum, kisi, yuklenme_tarihi, yukleyen:yukleyen_id ( ad_soyad ), departman_onayi, departman_onay_tarihi, satinalma_onayi, satinalma_onay_tarihi, talep_onayi, talep_onay_tarihi')
    .eq('id', params.id)
    .eq('fabrika_id', session.fabrikaId)
    .single();

  if (siparisErr || !siparis) return NextResponse.json({ error: 'Sipariş bulunamadı' }, { status: 404 });

  const { data: kalemler, error: kalemErr } = await supabase
    .from('siparis_kalemleri')
    .select('id, sira, satir_metni, stok_kodu, stok_adi, aciklama, miktar, teslim_tarihi, alindi, alinma_tarihi, alan:alan_personel_id ( ad_soyad )')
    .eq('siparis_id', params.id)
    .order('sira', { ascending: true });

  if (kalemErr) return NextResponse.json({ error: kalemErr.message }, { status: 500 });

  // Yükleme sırasında AÇIKLAMA'dan otomatik ayıklanan (veya manuel düzeltilen)
  // makine eşleşmelerini her kaleme iliştir.
  const kalemIdler = (kalemler || []).map((k) => k.id);
  const makineHaritasi: Record<string, { id: string; ad: string }[]> = {};
  if (kalemIdler.length > 0) {
    const { data: eslesenParcalar } = await supabase
      .from('yedek_parcalar')
      .select('siparis_kalemi_id, makine:makine_id ( id, ad )')
      .in('siparis_kalemi_id', kalemIdler);
    (eslesenParcalar || []).forEach((p: any) => {
      if (!p.siparis_kalemi_id || !p.makine) return;
      if (!makineHaritasi[p.siparis_kalemi_id]) makineHaritasi[p.siparis_kalemi_id] = [];
      makineHaritasi[p.siparis_kalemi_id].push({ id: p.makine.id, ad: p.makine.ad });
    });
  }
  const kalemlerZengin = (kalemler || []).map((k) => ({ ...k, makineler: makineHaritasi[k.id] || [] }));

  return NextResponse.json({ siparis, kalemler: kalemlerZengin });
}

const ONAY_ALANLARI = ['departman_onayi', 'satinalma_onayi', 'talep_onayi'] as const;

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = readSession();
  if (!session || session.rol !== 'admin') {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  }
  if (!session.fabrikaId) return NextResponse.json({ error: 'Bu işlem için fabrika bağlamı gerekli' }, { status: 403 });

  const body = await req.json();
  const supabase = supabaseAdmin();
  const updatePayload: Record<string, any> = {};

  for (const alan of ONAY_ALANLARI) {
    if (typeof body[alan] === 'boolean') {
      updatePayload[alan] = body[alan];
      updatePayload[`${alan.replace('_onayi', '_onay_tarihi')}`] = body[alan] ? new Date().toISOString() : null;
    }
  }

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json({ error: 'Güncellenecek alan bulunamadı' }, { status: 400 });
  }

  const { error } = await supabase.from('siparisler').update(updatePayload).eq('id', params.id).eq('fabrika_id', session.fabrikaId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = readSession();
  if (!session || session.rol !== 'admin') {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  }
  if (!session.fabrikaId) return NextResponse.json({ error: 'Bu işlem için fabrika bağlamı gerekli' }, { status: 403 });

  const supabase = supabaseAdmin();
  // siparis_kalemleri (ve buradan otomatik oluşan yedek_parcalar kayıtları)
  // "on delete cascade" olduğu için otomatik silinir.
  const { error } = await supabase.from('siparisler').delete().eq('id', params.id).eq('fabrika_id', session.fabrikaId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
