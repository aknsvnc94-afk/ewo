-- ============================================================
-- BAKIM YÖNETİM SİSTEMİ - Şema Güncelleme v22
-- Yardımcı Tesis Kontrol modülü: AnKA GLC (Modbus RTU/RS485 veya
-- Wi-Fi) tabanlı cihazlarla sıcaklık, pompa, kompresör ve chiller
-- izleme + uzaktan kontrol.
--
-- ÖNEMLİ MİMARİ NOT: Bu web uygulaması Vercel'de (bulut) çalışır ve
-- RS485/yerel ağdaki cihazlara doğrudan erişemez. Fabrika içinde 7/24
-- çalışan bir bilgisayarda ayrı bir "köprü" servisi (bkz. gateway/
-- klasörü) bu tablolarla Supabase üzerinden haberleşir: okuma yazar,
-- bekleyen komutları uygulayıp sonucu günceller.
--
-- Register adresleri KODA GÖMÜLMEZ — yardimci_tesis_ekipmanlar
-- tablosunda veri olarak tutulur. Üreticiden Modbus register tablosu
-- geldiğinde tek yapılacak, admin arayüzünden bu adresleri girmektir.
--
-- Bu dosyayı Supabase SQL Editor'de, v1-v21'den SONRA çalıştırın.
-- ============================================================

-- Fiziksel AnKA GLC cihazları (her biri bir RS485 hattı veya Wi-Fi bağlantısı)
create table if not exists yardimci_tesis_cihazlari (
  id uuid primary key default gen_random_uuid(),
  fabrika_id uuid not null references fabrikalar(id),
  ad text not null,                          -- örn. "Soğutma Odası GLC-1"
  baglanti_tipi text not null default 'rs485' check (baglanti_tipi in ('rs485', 'wifi_tcp')),
  -- rs485: köprü PC'sindeki seri port (örn. "COM3" veya "/dev/ttyUSB0"), baud_rate
  -- wifi_tcp: cihazın yerel ağdaki IP adresi ve Modbus TCP portu
  baglanti_ayarlari jsonb not null default '{}'::jsonb,
  modbus_slave_id int not null default 1,
  aktif boolean not null default true,
  son_gorulme timestamptz,                   -- köprü servisi her başarılı taramada günceller
  olusturma_tarihi timestamptz not null default now(),
  unique (fabrika_id, ad)
);

-- Bir cihaza bağlı her bir ekipman/ölçüm noktası (sıcaklık sensörü, pompa, kompresör, chiller vb.)
create table if not exists yardimci_tesis_ekipmanlar (
  id uuid primary key default gen_random_uuid(),
  fabrika_id uuid not null references fabrikalar(id),
  cihaz_id uuid not null references yardimci_tesis_cihazlari(id) on delete cascade,
  ad text not null,                          -- örn. "Kompresör 1", "Chiller Giriş Sıcaklığı"
  tur text not null check (tur in ('sicaklik', 'pompa', 'kompresor', 'chiller', 'diger')),
  kontrol_edilebilir boolean not null default false,  -- yalnızca okuma mı, açma/kapama da var mı

  -- Okuma (izleme) register bilgisi
  okuma_register_adresi int,
  okuma_register_tipi text check (okuma_register_tipi in ('coil', 'discrete_input', 'holding_register', 'input_register')),
  okuma_veri_tipi text default 'int16' check (okuma_veri_tipi in ('int16', 'uint16', 'float32', 'bool')),
  birim text,                                -- örn. "°C", "bar"
  carpan numeric default 1,                  -- ham değer * çarpan = gösterilecek değer (örn. 0.1)

  -- Yazma (kontrol) register bilgisi — kontrol_edilebilir=true ise dolu olmalı
  yazma_register_adresi int,
  yazma_register_tipi text check (yazma_register_tipi in ('coil', 'holding_register')),

  -- Setpoint (istenen sıcaklık/değer) register bilgisi — opsiyonel
  setpoint_register_adresi int,
  setpoint_min numeric,
  setpoint_max numeric,

  aktif boolean not null default true,
  siralama int not null default 0,
  olusturma_tarihi timestamptz not null default now()
);

-- Zaman serisi ölçüm kayıtları (köprü servisi periyodik olarak yazar)
create table if not exists yardimci_tesis_olcumler (
  id uuid primary key default gen_random_uuid(),
  fabrika_id uuid not null references fabrikalar(id),
  ekipman_id uuid not null references yardimci_tesis_ekipmanlar(id) on delete cascade,
  deger numeric not null,
  durum text,                                 -- pompa/kompresör için 'acik' | 'kapali' | 'ariza' vb. serbest metin
  olcum_zamani timestamptz not null default now()
);

create index if not exists idx_tesis_olcum_ekipman_zaman
  on yardimci_tesis_olcumler(ekipman_id, olcum_zamani desc);

-- Eski ölçümleri temizlemek isterseniz (opsiyonel, elle çalıştırılır):
-- delete from yardimci_tesis_olcumler where olcum_zamani < now() - interval '90 days';

-- Uzaktan kontrol komut kuyruğu: site buraya yazar, köprü servisi okuyup uygular
create table if not exists yardimci_tesis_komutlar (
  id uuid primary key default gen_random_uuid(),
  fabrika_id uuid not null references fabrikalar(id),
  ekipman_id uuid not null references yardimci_tesis_ekipmanlar(id) on delete cascade,
  komut_tipi text not null check (komut_tipi in ('ac_kapat', 'setpoint')),
  istenen_deger numeric not null,             -- ac_kapat: 1/0, setpoint: istenen sayısal değer
  durum text not null default 'bekliyor' check (durum in ('bekliyor', 'uygulandi', 'hata')),
  hata_mesaji text,
  isteyen_personel_id uuid references personel(id) on delete set null,
  olusturma_tarihi timestamptz not null default now(),
  uygulanma_tarihi timestamptz
);

create index if not exists idx_tesis_komut_bekleyen
  on yardimci_tesis_komutlar(fabrika_id, durum) where durum = 'bekliyor';

alter table yardimci_tesis_cihazlari enable row level security;
alter table yardimci_tesis_ekipmanlar enable row level security;
alter table yardimci_tesis_olcumler enable row level security;
alter table yardimci_tesis_komutlar enable row level security;

-- Her ekipman için en güncel ölçümü döndüren görünüm (dashboard'da kullanılır)
create or replace view yardimci_tesis_son_olcumler as
select distinct on (ekipman_id)
  ekipman_id, fabrika_id, deger, durum, olcum_zamani
from yardimci_tesis_olcumler
order by ekipman_id, olcum_zamani desc;
