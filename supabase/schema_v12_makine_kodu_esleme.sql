-- ============================================================
-- BAKIM YÖNETİM SİSTEMİ - Şema Güncelleme v12
-- Sipariş PDF'inden otomatik makine kodu eşleme (yedek parça izlenebilirliği)
-- Bu dosyayı Supabase SQL Editor'de, v1-v11'den SONRA çalıştırın.
-- ============================================================

-- Sipariş yüklemesi sırasında AÇIKLAMA alanından otomatik ayıklanan makine
-- kodlarıyla oluşturulan yedek_parcalar satırlarını kaynak siparişe bağlar
-- (izlenebilirlik + admin'in "Düzenle" ile düzeltebilmesi için).
alter table yedek_parcalar add column if not exists siparis_kalemi_id uuid references siparis_kalemleri(id) on delete set null;
create index if not exists idx_yedek_parca_siparis_kalemi on yedek_parcalar(siparis_kalemi_id);
