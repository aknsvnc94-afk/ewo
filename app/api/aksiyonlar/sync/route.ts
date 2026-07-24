import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { readSession } from '@/lib/session';

type OnlemGirdi = { aciklama: string; sorumlu_personel_id: string | null; plan_tarihi: string | null };

// Admin, EWO formundaki "Önlemler" tablolarını kaydettiğinde çağrılır.
// Basit yaklaşım: bu kayıt+tip için var olan TÜM aksiyonları silip, formdaki
// güncel (boş olmayan açıklamalı) satırları yeniden oluşturur. Personelin
// zaten kapattığı/onay bekleyen aksiyonlar korunur (silinmez, sadece
// içerik değişmemişse dokunulmaz).
export async function POST(req: NextRequest) {
  const session = readSession();
  if (!session || session.rol !== 'admin') {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  }

  const { ariza_kayit_id, tip, onlemler } = await req.json() as {
    ariza_kayit_id: string; tip: 'kok_neden' | 'sifir_ariza'; onlemler: OnlemGirdi[];
  };
  if (!ariza_kayit_id || !tip || !Array.isArray(onlemler)) {
    return NextResponse.json({ error: 'ariza_kayit_id, tip ve onlemler gerekli' }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  // Bu kayıt + tip için hâlâ "Açık" durumda olan (personel henüz dokunmamış)
  // eski aksiyonları temizle, sonra formdaki güncel satırları ekle.
  // Onay bekleyen / kapatılmış olanlara dokunmuyoruz ki personelin ilerlemesi kaybolmasın.
  await supabase.from('aksiyonlar').delete()
    .eq('ariza_kayit_id', ariza_kayit_id).eq('tip', tip).eq('durum', 'Açık');

  const gecerliOnlemler = onlemler
    .map((o, i) => ({ ...o, sira: i }))
    .filter((o) => o.aciklama && o.aciklama.trim().length > 0);

  if (gecerliOnlemler.length > 0) {
    const eklenecekler = gecerliOnlemler.map((o) => ({
      ariza_kayit_id,
      tip,
      sira: o.sira,
      aciklama: o.aciklama.trim(),
      sorumlu_personel_id: o.sorumlu_personel_id || null,
      plan_tarihi: o.plan_tarihi || null,
      durum: 'Açık',
    }));
    const { error } = await supabase.from('aksiyonlar').insert(eklenecekler);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, eklenen: gecerliOnlemler.length });
}
