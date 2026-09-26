-- ============================================================
-- BAKIM YÖNETİM SİSTEMİ - Şema Güncelleme v23
-- Web Push bildirimleri: personelin tarayıcı/PWA push aboneliklerini
-- tutar. Yeni sipariş eklendiğinde (ve ileride başka olaylarda)
-- ilgili personele push bildirimi göndermek için kullanılır.
-- Bu dosyayı Supabase SQL Editor'de, v1-v22'den SONRA çalıştırın.
-- ============================================================

create table if not exists push_abonelikleri (
  id uuid primary key default gen_random_uuid(),
  fabrika_id uuid not null references fabrikalar(id),
  personel_id uuid not null references personel(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  olusturma_tarihi timestamptz not null default now()
);

create index if not exists idx_push_personel on push_abonelikleri(personel_id);

alter table push_abonelikleri enable row level security;
