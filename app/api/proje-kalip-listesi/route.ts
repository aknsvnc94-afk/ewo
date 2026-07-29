import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { readSession } from '@/lib/session';

export async function GET() {
  const session = readSession();
  if (!session) return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  if (!session.fabrikaId) return NextResponse.json({ error: 'Bu işlem için fabrika bağlamı gerekli' }, { status: 403 });

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('proje_kalip_listesi')
    .select('kalip_kodu, kalip_kodu_normalize, kalip_adi')
    .eq('fabrika_id', session.fabrikaId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ kalipListesi: data });
}

export async function POST(req: NextRequest) {
  const session = readSession();
  if (!session || session.rol !== 'admin') {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  }
  if (!session.fabrikaId) return NextResponse.json({ error: 'Bu işlem için fabrika bağlamı gerekli' }, { status: 403 });

  const { kalipListesi } = await req.json();
  if (!Array.isArray(kalipListesi) || kalipListesi.length === 0) {
    return NextResponse.json({ error: 'kalipListesi gerekli' }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const benzersizMap = new Map<string, any>();
  kalipListesi.forEach((k: any) => {
    benzersizMap.set(k.kalip_kodu_normalize, {
      fabrika_id: session.fabrikaId,
      kalip_kodu: k.kalip_kodu,
      kalip_kodu_normalize: k.kalip_kodu_normalize,
      kalip_adi: k.kalip_adi || null,
    });
  });
  const eklenecekler = Array.from(benzersizMap.values());

  const { error } = await supabase
    .from('proje_kalip_listesi')
    .upsert(eklenecekler, { onConflict: 'fabrika_id,kalip_kodu_normalize' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, islenen: eklenecekler.length });
}
