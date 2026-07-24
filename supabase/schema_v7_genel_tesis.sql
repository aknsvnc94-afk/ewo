-- ============================================================
-- EWO TAKİP SİSTEMİ - Şema Güncelleme v7
-- Bu dosyayı Supabase SQL Editor'de, v1-v6'dan SONRA çalıştırın.
-- ============================================================

-- Kategoriye "GT - Genel Tesis" seçeneği ekleniyor (manuel kayıtlar için;
-- ERP importu hâlâ sadece MA/BA/KA/RA üretir).
alter table ariza_kayitlari drop constraint if exists ariza_kayitlari_kategori_check;
alter table ariza_kayitlari add constraint ariza_kayitlari_kategori_check
  check (kategori in ('MA', 'BA', 'KA', 'RA', 'GT'));
