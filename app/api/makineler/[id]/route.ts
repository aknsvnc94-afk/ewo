import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { readSession } from '@/lib/session';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
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
  const { error } = await supabase
    .from('makineler')
    .update({ ad: ad.toString().trim() })
    .eq('id', params.id)
    .eq('fabrika_id', session.fabrikaId);

  if (error) {
    const mesaj = error.message.includes('duplicate') || error.message.includes('unique')
      ? 'Bu isimde bir makine zaten var'
      : error.message;
    return NextResponse.json({ error: mesaj }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = readSession();
  if (!session || session.rol !== 'admin') {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  }
  if (!session.fabrikaId) return NextResponse.json({ error: 'Bu işlem için fabrika bağlamı gerekli' }, { status: 403 });

  const supabase = supabaseAdmin();
  // yedek_parcalar tablosu makine_id üzerinden "on delete cascade" olduğu için
  // bu makineye ait parçalar da otomatik silinir.
  const { error } = await supabase
    .from('makineler').delete().eq('id', params.id).eq('fabrika_id', session.fabrikaId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
