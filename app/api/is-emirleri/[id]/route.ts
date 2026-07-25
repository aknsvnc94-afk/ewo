import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { readSession } from '@/lib/session';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = readSession();
  if (!session) return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });

  const supabase = supabaseAdmin();

  const { data: isEmri } = await supabase
    .from('is_emirleri').select('atanan_personel_id').eq('id', params.id).single();
  if (!isEmri) return NextResponse.json({ error: 'İş emri bulunamadı' }, { status: 404 });

  if (session.rol === 'personel' && isEmri.atanan_personel_id !== session.id) {
    return NextResponse.json({ error: 'Bu iş emri size atanmamış' }, { status: 403 });
  }

  const { yapilan_is, durum } = await req.json();
  const updatePayload: Record<string, any> = {};

  if (yapilan_is !== undefined) updatePayload.yapilan_is = yapilan_is;

  if (durum === 'Kapatıldı') {
    updatePayload.durum = 'Kapatıldı';
    updatePayload.kapatma_tarihi = new Date().toISOString();
    updatePayload.kapatan_personel_id = session.id;
  } else if (durum === 'Açık') {
    updatePayload.durum = 'Açık';
    updatePayload.kapatma_tarihi = null;
    updatePayload.kapatan_personel_id = null;
  }

  const { error } = await supabase.from('is_emirleri').update(updatePayload).eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
