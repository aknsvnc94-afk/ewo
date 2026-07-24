import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { readSession } from '@/lib/session';

export async function GET() {
  const session = readSession();
  if (!session) return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('siparis_kalemleri')
    .select(`
      id, satir_metni, stok_kodu, miktar, teslim_tarihi, alindi, alinma_tarihi,
      alan:alan_personel_id ( ad_soyad ),
      siparis:siparis_id ( id, dosya_adi, talep_no, yuklenme_tarihi )
    `)
    .order('id', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ kalemler: data });
}
