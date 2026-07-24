import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { readSession } from '@/lib/session';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = readSession();
  if (!session) return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });

  const { durum, kapatma_aciklamasi } = await req.json();
  const supabase = supabaseAdmin();

  const { data: aksiyon } = await supabase
    .from('aksiyonlar').select('sorumlu_personel_id').eq('id', params.id).single();
  if (!aksiyon) return NextResponse.json({ error: 'Aksiyon bulunamadı' }, { status: 404 });

  if (session.rol === 'personel') {
    // Personel sadece kendine ait aksiyonu, sadece "Onay Bekliyor" durumuna geçirebilir (kapatma isteği)
    if (aksiyon.sorumlu_personel_id !== session.id) {
      return NextResponse.json({ error: 'Bu aksiyon size atanmamış' }, { status: 403 });
    }
    if (durum !== 'Onay Bekliyor') {
      return NextResponse.json({ error: 'Personel sadece kapatma isteği gönderebilir' }, { status: 403 });
    }
  }
  // Admin: 'Kapatıldı' (onayla) veya 'Açık' (reddet/geri aç) yapabilir

  const updatePayload: Record<string, any> = { durum };
  if (kapatma_aciklamasi !== undefined) updatePayload.kapatma_aciklamasi = kapatma_aciklamasi;

  const { error } = await supabase.from('aksiyonlar').update(updatePayload).eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
