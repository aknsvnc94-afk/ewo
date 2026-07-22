import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { readSession } from '@/lib/session';

const ALLOWED_STATUS = ['Beklemede', 'Devam Ediyor', 'Tamamlandı', 'İptal'];

export async function PATCH(req: NextRequest) {
  const session = readSession();
  if (!session) return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });

  const { id, aksiyon, hedef_tarih, tamamlanma_durumu, kok_neden_turu } = await req.json();
  if (!id) return NextResponse.json({ error: 'id gerekli' }, { status: 400 });

  if (tamamlanma_durumu && !ALLOWED_STATUS.includes(tamamlanma_durumu)) {
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
  if (aksiyon !== undefined) updatePayload.aksiyon = aksiyon;
  if (hedef_tarih !== undefined) updatePayload.hedef_tarih = hedef_tarih;
  if (tamamlanma_durumu !== undefined) updatePayload.tamamlanma_durumu = tamamlanma_durumu;
  if (kok_neden_turu !== undefined) updatePayload.kok_neden_turu = kok_neden_turu;

  const { error } = await supabase.from('ariza_kayitlari').update(updatePayload).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
