-- ============================================================
-- EWO TAKİP SİSTEMİ - Şema Güncelleme v6
-- Bu dosyayı Supabase SQL Editor'de, v1-v5'ten SONRA çalıştırın.
-- ============================================================

-- Satınalma talep formundaki 3 onay adımı (Departman Sorumlusu / Satın Alma
-- Sorumlusu / Talep Onayı) admin panelinden işaretlenebilsin diye.
alter table siparisler add column if not exists departman_onayi boolean not null default false;
alter table siparisler add column if not exists departman_onay_tarihi timestamptz;
alter table siparisler add column if not exists satinalma_onayi boolean not null default false;
alter table siparisler add column if not exists satinalma_onay_tarihi timestamptz;
alter table siparisler add column if not exists talep_onayi boolean not null default false;
alter table siparisler add column if not exists talep_onay_tarihi timestamptz;
