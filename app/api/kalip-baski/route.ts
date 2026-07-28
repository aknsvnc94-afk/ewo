import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { readSession } from '@/lib/session';

export async function GET(req: NextRequest) {
  const session = readSession();
  if (!session) return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  if (!session.fabrikaId) return NextResponse.json({ error: 'Bu işlem için fabrika bağlamı gerekli' }, { status: 403 });

  const ay = req.nextUrl.searchParams.get('ay');
  const ayaKadar = req.nextUrl.searchParams.get('ayaKadar');

  if (!ay && !ayaKadar) {
    return NextResponse.json({ error: 'ay veya ayaKadar parametresi gerekli (YYYY-MM)' }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  let query = supabase
    .from('kalip_baski_sayilari')
    .select('id, kalip_kodu, kalip_kodu_normalize, ay, yt_baski, guncel_baski_toplam, ariza_sayisi_manuel')
    .eq('fabrika_id', session.fabrikaId)
    .order('ay', { ascending: true });

  if (ayaKadar) query = query.lte('ay', ayaKadar);
  else if (ay) query = query.eq('ay', ay);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ kayitlar: data });
}

// hesaplaDelta=true: aylık ERP yüklemesi — sadece güncel (kümülatif) değer gelir,
//   o ayki gerçek baskı sayısı (yt_baski) burada, bir önceki ayın kümülatif değeriyle
//   farkı alınarak hesaplanır.
// hesaplaDelta=false (varsayılan): geçmiş ay toplu içe aktarımı — yt_baski, guncel_baski_toplam
//   ve ariza_sayisi_manuel zaten dosyadan doğrudan geliyor, hesaplama yapılmaz.
export async function POST(req: NextRequest) {
  const session = readSession();
  if (!session || session.rol !== 'admin') {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  }
  if (!session.fabrikaId) return NextResponse.json({ error: 'Bu işlem için fabrika bağlamı gerekli' }, { status: 403 });

  const { kayitlar, ay, hesaplaDelta } = await req.json();
  if (!Array.isArray(kayitlar) || kayitlar.length === 0) {
    return NextResponse.json({ error: 'kayitlar gerekli' }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  let eklenecekler: any[];

  if (hesaplaDelta) {
    if (!ay) return NextResponse.json({ error: 'ay gerekli' }, { status: 400 });

    // Dosyada aynı kalıp kodu birden fazla kez geçiyorsa (mükerrer satır), sadece sonuncusunu tut
    const benzersizKayitlarMap = new Map<string, any>();
    kayitlar.forEach((k: any) => benzersizKayitlarMap.set(k.kalip_kodu_normalize, k));
    const benzersizKayitlar = Array.from(benzersizKayitlarMap.values());

    // Her kalıp için, seçilen aydan ÖNCEKİ en yakın kaydı bul (kümülatif farkı almak için)
    const normKodlar = benzersizKayitlar.map((k: any) => k.kalip_kodu_normalize);
    const { data: oncekiKayitlar, error: oncekiErr } = await supabase
      .from('kalip_baski_sayilari')
      .select('kalip_kodu_normalize, ay, guncel_baski_toplam')
      .eq('fabrika_id', session.fabrikaId)
      .in('kalip_kodu_normalize', normKodlar)
      .lt('ay', ay)
      .order('ay', { ascending: false });

    // Her kalıp için en yakın (en son) önceki kaydı seç
    const oncekiMap: Record<string, number> = {};
    (oncekiKayitlar || []).forEach((k) => {
      if (oncekiMap[k.kalip_kodu_normalize] === undefined) {
        oncekiMap[k.kalip_kodu_normalize] = k.guncel_baski_toplam;
      }
    });

    eklenecekler = benzersizKayitlar.map((k: any) => {
      const oncekiGuncel = oncekiMap[k.kalip_kodu_normalize];
      const ayGerceklesen = oncekiGuncel !== undefined ? k.guncel_baski_toplam - oncekiGuncel : null;
      return {
        fabrika_id: session.fabrikaId,
        kalip_kodu: k.kalip_kodu,
        kalip_kodu_normalize: k.kalip_kodu_normalize,
        ay,
        guncel_baski_toplam: k.guncel_baski_toplam,
        yt_baski: ayGerceklesen,
        ariza_sayisi_manuel: null, // canlı EWO'dan hesaplanacak
        yukleyen_id: session.id,
      };
    });
  } else {
    // Geçmiş ay toplu içe aktarımı: her şey dosyadan doğrudan geliyor.
    // Aynı kalıp+ay için dosyada mükerrer satır varsa (Postgres "ON CONFLICT" hatası
    // vermemesi için) sadece sonuncusunu tutuyoruz.
    const benzersizMap = new Map<string, any>();
    kayitlar.forEach((k: any) => {
      const anahtarAy = k.ay || ay;
      benzersizMap.set(`${k.kalip_kodu_normalize}|${anahtarAy}`, {
        fabrika_id: session.fabrikaId,
        kalip_kodu: k.kalip_kodu,
        kalip_kodu_normalize: k.kalip_kodu_normalize,
        ay: anahtarAy,
        guncel_baski_toplam: k.guncel_baski_toplam ?? null,
        yt_baski: k.yt_baski,
        ariza_sayisi_manuel: k.ariza_sayisi_manuel ?? null,
        yukleyen_id: session.id,
      });
    });
    eklenecekler = Array.from(benzersizMap.values());
    if (eklenecekler.some((k: any) => !k.ay)) {
      return NextResponse.json({ error: 'Her kayıt için ay (YYYY-MM) gerekli' }, { status: 400 });
    }
  }

  const { error } = await supabase
    .from('kalip_baski_sayilari')
    .upsert(eklenecekler, { onConflict: 'fabrika_id,kalip_kodu_normalize,ay' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, islenen: eklenecekler.length });
}

// Tüm baskı sayısı verilerini temizler (yanlış/test içe aktarımlarını sıfırlamak için)
export async function DELETE(req: NextRequest) {
  const session = readSession();
  if (!session || session.rol !== 'admin') {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  }
  if (!session.fabrikaId) return NextResponse.json({ error: 'Bu işlem için fabrika bağlamı gerekli' }, { status: 403 });

  const supabase = supabaseAdmin();
  const { error, count } = await supabase
    .from('kalip_baski_sayilari')
    .delete({ count: 'exact' })
    .eq('fabrika_id', session.fabrikaId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, silinen: count ?? 0 });
}
