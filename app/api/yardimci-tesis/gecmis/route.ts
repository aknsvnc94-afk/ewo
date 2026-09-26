import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { readSession } from '@/lib/session';

export async function GET(req: NextRequest) {
  const session = readSession();
  if (!session) return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  if (!session.fabrikaId) return NextResponse.json({ error: 'Bu işlem için fabrika bağlamı gerekli' }, { status: 403 });

  const ekipmanId = req.nextUrl.searchParams.get('ekipman_id');
  if (!ekipmanId) return NextResponse.json({ error: 'ekipman_id gerekli' }, { status: 400 });

  const saatParam = Number(req.nextUrl.searchParams.get('saat') || '24');
  const saat = Number.isFinite(saatParam) && saatParam > 0 ? Math.min(saatParam, 24 * 30) : 24;
  const baslangic = new Date(Date.now() - saat * 60 * 60 * 1000).toISOString();

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('yardimci_tesis_olcumler')
    .select('deger, durum, olcum_zamani')
    .eq('fabrika_id', session.fabrikaId)
    .eq('ekipman_id', ekipmanId)
    .gte('olcum_zamani', baslangic)
    .order('olcum_zamani', { ascending: true })
    .limit(2000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ olcumler: data });
}
