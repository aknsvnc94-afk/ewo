-- ============================================================
-- EWO TAKİP SİSTEMİ - Şema Güncelleme v2
-- Bu dosyayı Supabase SQL Editor'de, schema.sql'den SONRA çalıştırın.
-- (schema.sql'i zaten çalıştırdıysanız sadece bu dosyayı ek olarak çalıştırmanız yeterli)
-- ============================================================

-- ------------------------------------------------------------
-- 1) ARIZA MÜDAHALE ve ANALİZ FORMU (EWO - F13-31) alanları
-- ------------------------------------------------------------
alter table ariza_kayitlari
  add column if not exists ariza_turu text[] default '{}',              -- PLC/Yazılım/Mekanik/Elektrik/Hidrolik/Pnömatik (çoklu seçim)
  add column if not exists arizanin_tanimi text,
  add column if not exists direk_sebep_cozum text,

  -- ZAMAN bölümü
  add column if not exists zaman_ariza_baslangic timestamptz,
  add column if not exists zaman_mudahale_baslangic timestamptz,
  add column if not exists zaman_teshis_baslangic timestamptz,
  add column if not exists zaman_tamir_baslangic timestamptz,
  add column if not exists zaman_yedek_parca_bekleme timestamptz,
  add column if not exists zaman_montaj_baslangic timestamptz,
  add column if not exists zaman_makine_baslatilma timestamptz,
  add column if not exists zaman_uretim_baslangic timestamptz,

  -- 5 Neden Analizi
  add column if not exists direk_sebep text,
  add column if not exists neden_1 text,
  add column if not exists neden_2 text,
  add column if not exists neden_3 text,
  add column if not exists neden_4 text,
  add column if not exists neden_5 text,

  -- Önlemler tabloları (esnek yapı için JSONB: [{aciklama, sorumlu, plan_tarihi}, ...])
  add column if not exists onlemler_kok_neden jsonb default '[]'::jsonb,
  add column if not exists onlemler_sifir_ariza jsonb default '[]'::jsonb,

  add column if not exists analiz_sorumlusu text,
  add column if not exists sonuc text,
  add column if not exists dokuman_no text default 'F13-31(R00)';

-- ------------------------------------------------------------
-- 2) "Onay Bekliyor" durumu ekleniyor (personel formu doldurup gönderince)
-- ------------------------------------------------------------
alter table ariza_kayitlari drop constraint if exists ariza_kayitlari_tamamlanma_durumu_check;
alter table ariza_kayitlari add constraint ariza_kayitlari_tamamlanma_durumu_check
  check (tamamlanma_durumu in ('Beklemede','Devam Ediyor','Onay Bekliyor','Tamamlandı','İptal'));

-- ------------------------------------------------------------
-- 3) Admin panelinden personel ekleme RPC'si (şifreyi güvenle hashler)
-- ------------------------------------------------------------
create or replace function personel_ekle(
  p_ad_soyad text, p_kullanici_adi text, p_sifre text, p_rol text default 'personel'
)
returns table(id uuid) as $$
begin
  return query
    insert into personel (ad_soyad, kullanici_adi, pin_hash, rol)
    values (p_ad_soyad, lower(trim(p_kullanici_adi)), crypt(p_sifre, gen_salt('bf')), p_rol)
    returning personel.id;
end;
$$ language plpgsql security definer;
