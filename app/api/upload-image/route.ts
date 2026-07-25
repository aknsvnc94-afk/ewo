import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { readSession } from '@/lib/session';

const BUCKET = 'cozum-resimleri';

export async function POST(req: NextRequest) {
  const session = readSession();
  if (!session) return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  if (!session.fabrikaId) return NextResponse.json({ error: 'Bu işlem için fabrika bağlamı gerekli' }, { status: 403 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const kayitId = formData.get('kayit_id') as string | null;
  if (!file || !kayitId) {
    return NextResponse.json({ error: 'file ve kayit_id gerekli' }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  const { data: mevcut } = await supabase
    .from('ariza_kayitlari')
    .select('cozum_resimleri, fabrika_id')
    .eq('id', kayitId)
    .single();
  if (!mevcut || mevcut.fabrika_id !== session.fabrikaId) {
    return NextResponse.json({ error: 'Kayıt bulunamadı' }, { status: 404 });
  }

  const uzanti = file.name.split('.').pop() || 'jpg';
  const dosyaAdi = `${kayitId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${uzanti}`;

  const buf = Buffer.from(await file.arrayBuffer());

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(dosyaAdi, buf, { contentType: file.type || 'image/jpeg', upsert: false });

  if (uploadErr) {
    return NextResponse.json({
      error: `Yükleme başarısız: ${uploadErr.message}. Supabase Storage'da "${BUCKET}" adında genel (public) bir bucket oluşturduğunuzdan emin olun.`,
    }, { status: 500 });
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(dosyaAdi);

  const yeniListe = [...(mevcut.cozum_resimleri || []), urlData.publicUrl];
  await supabase.from('ariza_kayitlari').update({ cozum_resimleri: yeniListe }).eq('id', kayitId);

  return NextResponse.json({ ok: true, url: urlData.publicUrl, resimler: yeniListe });
}

export async function DELETE(req: NextRequest) {
  const session = readSession();
  if (!session) return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  if (!session.fabrikaId) return NextResponse.json({ error: 'Bu işlem için fabrika bağlamı gerekli' }, { status: 403 });

  const { kayit_id, url } = await req.json();
  if (!kayit_id || !url) return NextResponse.json({ error: 'kayit_id ve url gerekli' }, { status: 400 });

  const supabase = supabaseAdmin();
  const { data: mevcut } = await supabase
    .from('ariza_kayitlari')
    .select('cozum_resimleri, fabrika_id')
    .eq('id', kayit_id)
    .single();
  if (!mevcut || mevcut.fabrika_id !== session.fabrikaId) {
    return NextResponse.json({ error: 'Kayıt bulunamadı' }, { status: 404 });
  }

  const yeniListe = (mevcut.cozum_resimleri || []).filter((u: string) => u !== url);
  await supabase.from('ariza_kayitlari').update({ cozum_resimleri: yeniListe }).eq('id', kayit_id);

  return NextResponse.json({ ok: true, resimler: yeniListe });
}
