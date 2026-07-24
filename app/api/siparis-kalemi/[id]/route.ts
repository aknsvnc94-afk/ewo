import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { readSession } from '@/lib/session';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = readSession();
  if (!session) return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });

  const { alindi } = await req.json();
  const supabase = supabaseAdmin();

  const updatePayload = alindi
    ? { alindi: true, alan_personel_id: session.id, alinma_tarihi: new Date().toISOString() }
    : { alindi: false, alan_personel_id: null, alinma_tarihi: null };

  const { error } = await supabase.from('siparis_kalemleri').update(updatePayload).eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
