import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { readSession } from '@/lib/session';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = readSession();
  if (!session || session.rol !== 'admin') {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  }
  if (!session.fabrikaId) return NextResponse.json({ error: 'Bu işlem için fabrika bağlamı gerekli' }, { status: 403 });

  const { parca_kodu, parca_tanimi } = await req.json();
  const updatePayload: Record<string, any> = {};
  if (parca_kodu !== undefined) updatePayload.parca_kodu = parca_kodu || null;
  if (parca_tanimi !== undefined) {
    if (!parca_tanimi.toString().trim()) {
      return NextResponse.json({ error: 'Parça tanımı boş olamaz' }, { status: 400 });
    }
    updatePayload.parca_tanimi = parca_tanimi.toString().trim();
  }
  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json({ error: 'Güncellenecek alan bulunamadı' }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from('yedek_parcalar').update(updatePayload).eq('id', params.id).eq('fabrika_id', session.fabrikaId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = readSession();
  if (!session || session.rol !== 'admin') {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  }
  if (!session.fabrikaId) return NextResponse.json({ error: 'Bu işlem için fabrika bağlamı gerekli' }, { status: 403 });

  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from('yedek_parcalar').delete().eq('id', params.id).eq('fabrika_id', session.fabrikaId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
