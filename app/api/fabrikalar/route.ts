import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { readSession } from '@/lib/session';

// Giriş ekranındaki fabrika seçim listesi için — girişten önce çağrıldığından
// auth gerektirmez (sadece fabrika adı/kodu döner, hassas veri yok).
export async function GET() {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('fabrikalar')
    .select('id, ad, kod')
    .eq('aktif', true)
    .order('ad');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ fabrikalar: data });
}

const TURKCE_HARF_MAP: Record<string, string> = {
  ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u',
  Ç: 'c', Ğ: 'g', İ: 'i', Ö: 'o', Ş: 's', Ü: 'u',
};

function slugOlustur(ad: string) {
  const donusturulmus = ad.split('').map((c) => TURKCE_HARF_MAP[c] ?? c).join('');
  const slug = donusturulmus
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'fabrika';
}

// Sadece süper admin yeni fabrika ekleyebilir.
export async function POST(req: NextRequest) {
  const session = readSession();
  if (!session || session.rol !== 'superadmin') {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  }

  const { ad } = await req.json();
  if (!ad || !ad.toString().trim()) {
    return NextResponse.json({ error: 'Fabrika adı gerekli' }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const temelKod = slugOlustur(ad);
  let kod = temelKod;
  let deneme = 1;
  while (true) {
    const { data: mevcut } = await supabase.from('fabrikalar').select('id').eq('kod', kod).maybeSingle();
    if (!mevcut) break;
    deneme += 1;
    kod = `${temelKod}-${deneme}`;
  }

  const { data, error } = await supabase
    .from('fabrikalar')
    .insert({ ad: ad.toString().trim(), kod })
    .select('id, ad, kod')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, fabrika: data });
}
