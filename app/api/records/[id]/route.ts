import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { readSession } from '@/lib/session';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = readSession();
  if (!session) return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('ariza_kayitlari')
    .select(`*, personel:atanan_personel_id ( ad_soyad )`)
    .eq('id', params.id)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Kayıt bulunamadı' }, { status: 404 });

  if (session.rol === 'personel' && data.atanan_personel_id !== session.id) {
    return NextResponse.json({ error: 'Bu kayıt size atanmamış' }, { status: 403 });
  }

  return NextResponse.json({ kayit: data });
}
