import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { readSession } from '@/lib/session';

export async function GET(req: NextRequest) {
  const session = readSession();
  if (!session) return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  if (!session.fabrikaId) return NextResponse.json({ error: 'Bu işlem için fabrika bağlamı gerekli' }, { status: 403 });

  const makineId = req.nextUrl.searchParams.get('makine_id');
  if (!makineId) return NextResponse.json({ error: 'makine_id gerekli' }, { status: 400 });

  const supabase = supabaseAdmin();

  const { data, error } = await supabase
    .from('yedek_parcalar')
    .select(`
      id, parca_kodu, parca_tanimi, created_at, siparis_kalemi_id,
      ekleyen:ekleyen_personel_id ( ad_soyad ),
      siparis_kalemi:siparis_kalemi_id ( siparis:siparis_id ( talep_no ) )
    `)
    .eq('fabrika_id', session.fabrikaId)
    .eq('makine_id', makineId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const parcalar = (data || []).map((k) => {
    const ekleyenAd: string | null = (k.ekleyen as any)?.ad_soyad || null;
    const talepNo: string | null = (k.siparis_kalemi as any)?.siparis?.talep_no || null;
    return {
      id: k.id,
      kaynak: k.siparis_kalemi_id ? ('siparis' as const) : ('manuel' as const),
      parca_kodu: k.parca_kodu,
      parca_tanimi: k.parca_tanimi,
      tarih: k.created_at,
      ekleyen: ekleyenAd || (talepNo ? `Talep No: ${talepNo}` : null),
    };
  });

  return NextResponse.json({ parcalar });
}

export async function POST(req: NextRequest) {
  const session = readSession();
  if (!session || session.rol !== 'admin') {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  }
  if (!session.fabrikaId) return NextResponse.json({ error: 'Bu işlem için fabrika bağlamı gerekli' }, { status: 403 });

  const { makine_id, parca_kodu, parca_tanimi } = await req.json();
  if (!makine_id || !parca_tanimi || !parca_tanimi.toString().trim()) {
    return NextResponse.json({ error: 'makine_id ve parça tanımı gerekli' }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  const { data: makine } = await supabase.from('makineler').select('fabrika_id').eq('id', makine_id).single();
  if (!makine || makine.fabrika_id !== session.fabrikaId) {
    return NextResponse.json({ error: 'Makine bulunamadı' }, { status: 404 });
  }

  const { data, error } = await supabase.from('yedek_parcalar').insert({
    fabrika_id: session.fabrikaId,
    makine_id,
    parca_kodu: parca_kodu || null,
    parca_tanimi: parca_tanimi.toString().trim(),
    ekleyen_personel_id: session.id,
  }).select('id').single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
