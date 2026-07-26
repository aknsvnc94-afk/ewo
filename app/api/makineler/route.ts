import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { readSession } from '@/lib/session';

export async function GET() {
  const session = readSession();
  if (!session) return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  if (!session.fabrikaId) return NextResponse.json({ error: 'Bu işlem için fabrika bağlamı gerekli' }, { status: 403 });

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('makineler')
    .select('id, ad, aktif')
    .eq('fabrika_id', session.fabrikaId)
    .eq('aktif', true)
    .order('ad');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ makineler: data });
}

export async function POST(req: NextRequest) {
  const session = readSession();
  if (!session || session.rol !== 'admin') {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  }
  if (!session.fabrikaId) return NextResponse.json({ error: 'Bu işlem için fabrika bağlamı gerekli' }, { status: 403 });

  const { ad } = await req.json();
  if (!ad || !ad.toString().trim()) {
    return NextResponse.json({ error: 'Makine adı gerekli' }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('makineler')
    .insert({ ad: ad.toString().trim(), fabrika_id: session.fabrikaId })
    .select('id, ad, aktif')
    .single();

  if (error) {
    const mesaj = error.message.includes('duplicate') || error.message.includes('unique')
      ? 'Bu makine zaten ekli'
      : error.message;
    return NextResponse.json({ error: mesaj }, { status: 400 });
  }
  return NextResponse.json({ ok: true, makine: data });
}
