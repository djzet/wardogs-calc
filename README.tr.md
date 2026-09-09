# WARDOGS — Havan ve Topçu Hesaplayıcısı | İnteraktif 16×16 km Harita

[Русский](README.md) · [English](README.en.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Español](README.es.md) · [Polski](README.pl.md) · [Українська](README.uk.md) · [Türkçe](README.tr.md) · [中文](README.zh.md)

**WARDOGS** taktik nişancı oyunu için resmi olmayan interaktif havan ve topçu
hesaplayıcısı. Mesafe, azimut, yükselme (mils) — 16×16 km
haritada iki tıklamayla.

**Canlı Demo:** https://djzet.github.io/wardogs-calc/

| Desktop | Mobil |
| :-: | :-: |
| ![desktop](assets/screenshots/desktop.png) | ![mobile](assets/screenshots/mobile.png) |

## Özellikler

- Kare zoom ve pan özellikli interaktif harita
- Mesafe, azimut ve yükselme (mils) hesaplama
- Havan (684 m) ve topçu (2679 m)
- İki harita: Bakurani ve Ozeti (16×16 km)
- Çizim araçları: kalem, cetvel, işaretleyici, silgi
- Bakurani haritasında kuleler ve bölge
- Koordinat paylaşımı için paylaşım bağlantıları
- Ayarları ve noktaları localStorage'a otomatik kaydetme
- Koyu ve açık temalar
- 9 arayüz dili (ru, en, de, fr, es, pl, uk, tr, zh)
- Mobil cihazlar için duyarlı tasarım

## Hızlı Başlangıç

```bash
# Bağımlılıkları yükleme
npm install

# Geliştirme sunucusunu başlat (http://localhost:5173)
npm run dev

# Üretim için derleme (dist/)
npm run build

# Derleme önizleme (http://localhost:4173)
npm run preview
```

## Proje Yapısı

```
wardogs-calc/
├── assets/           # Simgeler ve ekran görüntüleri
├── config/           # Harita ayarları ve balistik tablolar
├── js/
│   ├── core/         # Matematik, koordinatlar, hesaplayıcı
│   ├── features/     # Depolama, paylaşım, noktalar, silahlar, analitik
│   ├── map/          # Kareler, motor, etkileşimler, kamera
│   ├── ui/           # Paneller, giriş alanları, bağlam menüsü
│   ├── locales.js    # Yerelleştirme yöneticisi (9 dil)
│   └── index.js      # Ana modül: init, olay bağlama
├── maps/             # Harita kareleri (Bakurani, Ozeti)
├── public/           # Statik: locales, robots.txt, sitemap
├── src/main.js       # Vite giriş noktası
├── styles/           # CSS: değişkenler, base, panel, map, mobile
├── index.html        # Ana markup
└── vite.config.js    # Vite yapılandırması + harita eklentisi
```

## Teknolojiler

- **Vite** — derleme aracı ve geliştirme sunucusu
- **Vanilla JS** — frameworksüz (IIFE + window.*)
- **Canvas API** — harita işleme ve çizim araçları
- **CSS Variables** — tema desteği

## İletişim

- egor.silaev2003@yandex.ru
- [Wardogs CIS](https://discord.gg/kwxrTCJxre)
- @djzet

## Lisans

MIT © Egor Silaev
