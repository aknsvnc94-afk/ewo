import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { readSession } from '@/lib/session';

export async function GET(req: NextRequest) {
  const session = readSession();
  if (!session) return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  if (!session.fabrikaId) return NextResponse.json({ error: 'Bu işlem için fabrika bağlamı gerekli' }, { status: 403 });

  const ay = req.nextUrl.searchParams.get('ay');
  if (!ay) return NextResponse.json({ error: 'ay parametresi gerekli (YYYY-MM)' }, { status: 400 });

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('kalip_baski_sayilari')
    .select('id, kalip_kodu, kalip_kodu_normalize, ay, yt_baski')
    .eq('fabrika_id', session.fabrikaId)
    .eq('ay', ay);

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
  if (!Array.isArray(kayitlar) || kayitlar.length === 0 || !ay) {
    return NextResponse.json({ error: 'kayitlar ve ay gerekli' }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  const eklenecekler = kayitlar.map((k: any) => ({
    fabrika_id: session.fabrikaId,
    kalip_kodu: k.kalip_kodu,
    kalip_kodu_normalize: k.kalip_kodu_normalize,
    ay,
    yt_baski: k.yt_baski,
    yukleyen_id: session.id,
  }));

  // Aynı kalıp + ay için tekrar yüklenirse üzerine yazsın (upsert)
  const { error } = await supabase
    .from('kalip_baski_sayilari')
    .upsert(eklenecekler, { onConflict: 'fabrika_id,kalip_kodu_normalize,ay' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, islenen: eklenecekler.length });
}
