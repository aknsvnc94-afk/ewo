-- ============================================================
-- BAKIM YÖNETİM SİSTEMİ - Şema Güncelleme v18
-- MSBF için "diğer aylardan/kaynaklardan gelen" manuel taban değerleri
-- (Genel Toplam MSBF hesaplamasına dahil edilir)
-- Bu dosyayı Supabase SQL Editor'de, v1-v17'den SONRA çalıştırın.
-- ============================================================

create table if not exists msbf_taban_degerleri (
  fabrika_id uuid primary key references fabrikalar(id),
  taban_baski bigint not null default 0,
  taban_ariza int not null default 0,
  aciklama text,
  guncelleyen_id uuid references personel(id) on delete set null,
  guncelleme_tarihi timestamptz not null default now()
);

alter table msbf_taban_degerleri enable row level security;
