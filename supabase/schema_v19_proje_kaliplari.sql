-- ============================================================
-- BAKIM YÖNETİM SİSTEMİ - Şema Güncelleme v19
-- "Yeni Proje Kalıpları" için ayrı bir MSBF grubu desteği.
-- Bu dosyayı Supabase SQL Editor'de, v1-v18'den SONRA çalıştırın.
-- ============================================================

-- Hangi kalıp kodlarının "Yeni Proje Kalıpları" grubuna dahil olduğunu tutar
create table if not exists proje_kalip_listesi (
  id uuid primary key default gen_random_uuid(),
  fabrika_id uuid not null references fabrikalar(id),
  kalip_kodu text not null,
  kalip_kodu_normalize text not null,
  kalip_adi text,
  yuklenme_tarihi timestamptz not null default now(),
  unique (fabrika_id, kalip_kodu_normalize)
);

alter table proje_kalip_listesi enable row level security;

-- msbf_taban_degerleri tablosunu birden fazla grup (fompak_martur, proje_kalip vb.)
-- destekleyecek şekilde genişletiyoruz.
alter table msbf_taban_degerleri drop constraint if exists msbf_taban_degerleri_pkey;
alter table msbf_taban_degerleri add column if not exists grup text not null default 'fompak_martur';
alter table msbf_taban_degerleri add constraint msbf_taban_degerleri_pkey primary key (fabrika_id, grup);
