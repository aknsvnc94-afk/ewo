'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PanelAnaSayfa() {
  const router = useRouter();
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => router.replace(`/panel/${d.bolum || 'bakim'}`))
      .catch(() => router.replace('/'));
  }, [router]);
  return <p className="muted">Yönlendiriliyor...</p>;
}
