'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Eski yönetim panosu yerini bölüm bazlı /panel yapısına bıraktı.
// Kayıtlı bağlantıların çalışmaya devam etmesi için yönlendiriyoruz.
export default function EskiAdminPanosu() {
  const router = useRouter();
  useEffect(() => { router.replace('/panel'); }, [router]);
  return <p className="muted" style={{ padding: 24 }}>Yönlendiriliyor...</p>;
}
