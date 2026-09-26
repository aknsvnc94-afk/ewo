import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { readSession } from '@/lib/session';

export async function POST(req: NextRequest) {
  const session = readSession();
  if (!session) return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
  if (!session.fabrikaId) return NextResponse.json({ error: 'Bu işlem için fabrika bağlamı gerekli' }, { status: 403 });

  const { subscription } = await req.json();
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return NextResponse.json({ error: 'Geçersiz abonelik verisi' }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from('push_abonelikleri')
    .upsert({
      fabrika_id: session.fabrikaId,
      personel_id: session.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    }, { onConflict: 'endpoint' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = readSession();
  if (!session) return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });

  const { endpoint } = await req.json();
  if (!endpoint) return NextResponse.json({ error: 'endpoint gerekli' }, { status: 400 });

  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from('push_abonelikleri')
    .delete()
    .eq('endpoint', endpoint)
    .eq('personel_id', session.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
