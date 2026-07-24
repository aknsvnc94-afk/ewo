import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { readSession } from '@/lib/session';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = readSession();
  if (!session) return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('ariza_kayitlari')
    .select(`*, personel:atanan_personel_id ( ad_soyad )`)
    .eq('id', params.id)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Kayıt bulunamadı' }, { status: 404 });

  if (session.rol === 'personel' && data.atanan_personel_id !== session.id) {
    return NextResponse.json({ error: 'Bu kayıt size atanmamış' }, { status: 403 });
  }

  // Önlem tablolarındaki "sorumlu_personel_id" değerlerini isimlere çözümle
  // (PDF ve inceleme ekranlarında okunabilir göstermek için)
  const idler = new Set<string>();
  for (const liste of [data.onlemler_kok_neden, data.onlemler_sifir_ariza]) {
    (Array.isArray(liste) ? liste : []).forEach((o: any) => {
      if (o?.sorumlu_personel_id) idler.add(o.sorumlu_personel_id);
    });
  }

  let adMap: Record<string, string> = {};
  if (idler.size > 0) {
    const { data: personeller } = await supabase
      .from('personel').select('id, ad_soyad').in('id', Array.from(idler));
    adMap = Object.fromEntries((personeller || []).map((p) => [p.id, p.ad_soyad]));
  }

  const zenginlestir = (liste: any) =>
    (Array.isArray(liste) ? liste : []).map((o: any) => ({
      ...o,
      sorumlu_ad_soyad: o?.sorumlu_personel_id ? (adMap[o.sorumlu_personel_id] || '') : '',
    }));

  data.onlemler_kok_neden = zenginlestir(data.onlemler_kok_neden);
  data.onlemler_sifir_ariza = zenginlestir(data.onlemler_sifir_ariza);

  return NextResponse.json({ kayit: data });
}
