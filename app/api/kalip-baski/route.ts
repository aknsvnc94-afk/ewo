import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { readSession } from '@/lib/session';

export async function GET(req: NextRequest) {
  const session = readSession();
  if (!session) return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  if (!session.fabrikaId) return NextResponse.json({ error: 'Bu işlem için fabrika bağlamı gerekli' }, { status: 403 });

  // "ay" tek bir ayı getirir (örn. sadece o ayın yükleme durumunu göstermek için).
  // "ayaKadar" verilirse, o aya kadar (dahil) TÜM ayların kayıtları döner —
  // MSBF'nin kümülatif hesaplanabilmesi için kullanılır.
  const ay = req.nextUrl.searchParams.get('ay');
  const ayaKadar = req.nextUrl.searchParams.get('ayaKadar');

  if (!ay && !ayaKadar) {
    return NextResponse.json({ error: 'ay veya ayaKadar parametresi gerekli (YYYY-MM)' }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  let query = supabase
    .from('kalip_baski_sayilari')
    .select('id, kalip_kodu, kalip_kodu_normalize, ay, yt_baski, ariza_sayisi_manuel')
    .eq('fabrika_id', session.fabrikaId);

  if (ayaKadar) query = query.lte('ay', ayaKadar);
  else if (ay) query = query.eq('ay', ay);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ kayitlar: data });
}

export async function POST(req: NextRequest) {
  const session = readSession();
  if (!session || session.rol !== 'admin') {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  }
  if (!session.fabrikaId) return NextResponse.json({ error: 'Bu işlem için fabrika bağlamı gerekli' }, { status: 403 });

  const { kayitlar, ay } = await req.json();
  if (!Array.isArray(kayitlar) || kayitlar.length === 0) {
    return NextResponse.json({ error: 'kayitlar gerekli' }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  // Her kayıt kendi "ay" bilgisini taşıyabilir (geçmiş ay toplu içe aktarımında,
  // dosyanın kendisi birden fazla ay içerir); taşımıyorsa üstten gelen ortak "ay" kullanılır.
  const eklenecekler = kayitlar.map((k: any) => ({
    fabrika_id: session.fabrikaId,
    kalip_kodu: k.kalip_kodu,
    kalip_kodu_normalize: k.kalip_kodu_normalize,
    ay: k.ay || ay,
    yt_baski: k.yt_baski,
    ariza_sayisi_manuel: k.ariza_sayisi_manuel ?? null,
    yukleyen_id: session.id,
  }));

  if (eklenecekler.some((k: any) => !k.ay)) {
    return NextResponse.json({ error: 'Her kayıt için ay (YYYY-MM) gerekli' }, { status: 400 });
  }

  // Aynı kalıp + ay için tekrar yüklenirse üzerine yazsın (upsert)
  const { error } = await supabase
    .from('kalip_baski_sayilari')
    .upsert(eklenecekler, { onConflict: 'fabrika_id,kalip_kodu_normalize,ay' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, islenen: eklenecekler.length });
}
