-- ============================================================
-- BAKIM YÖNETİM SİSTEMİ - Şema Güncelleme v14
-- Kalıp baskı sayıları (MSBF - Mean Shot Between Failure hesaplaması için)
-- Bu dosyayı Supabase SQL Editor'de, v1-v13'ten SONRA çalıştırın.
-- ============================================================

create table if not exists kalip_baski_sayilari (
  id uuid primary key default gen_random_uuid(),
  fabrika_id uuid not null references fabrikalar(id),
  kalip_kodu text not null,
  kalip_kodu_normalize text not null,
  ay text not null,                    -- 'YYYY-MM' formatında (örn. '2026-06')
  yt_baski integer not null default 0, -- o ay gerçekleşen baskı sayısı
  yuklenme_tarihi timestamptz not null default now(),
  yukleyen_id uuid references personel(id) on delete set null,
  unique (fabrika_id, kalip_kodu_normalize, ay)
);

create index if not exists idx_kalip_baski_fabrika_ay on kalip_baski_sayilari(fabrika_id, ay);

alter table kalip_baski_sayilari enable row level security;
-- Not: diğer tablolarda olduğu gibi tüm erişim service_role ile API route'ları üzerinden yapılır.
