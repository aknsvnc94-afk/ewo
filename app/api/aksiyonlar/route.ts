import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { readSession } from '@/lib/session';

export async function GET(req: NextRequest) {
  const session = readSession();
  if (!session) return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });

  const supabase = supabaseAdmin();
  let query = supabase
    .from('aksiyonlar')
    .select(`
      id, tip, sira, aciklama, plan_tarihi, durum, kapatma_aciklamasi, ariza_kayit_id, sorumlu_personel_id,
      sorumlu:sorumlu_personel_id ( ad_soyad ),
      kayit:ariza_kayit_id ( tezgah, kategori, durus_adi, baslangic )
    `)
    .order('plan_tarihi', { ascending: true, nullsFirst: false });

  if (session.rol === 'personel') {
    query = query.eq('sorumlu_personel_id', session.id);
  }

  const durum = req.nextUrl.searchParams.get('durum');
  if (durum) query = query.eq('durum', durum);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ aksiyonlar: data });
}
