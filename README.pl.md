# WARDOGS — Kalkulator Moździerza i Artylerii | Interaktywna Mapa 16×16 km

[Русский](README.md) · [English](README.en.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Español](README.es.md) · [Polski](README.pl.md) · [Українська](README.uk.md) · [Türkçe](README.tr.md) · [中文](README.zh.md)

Nieoficjalny interaktywny kalkulator moździerza i artylerii dla taktycznej
strzelanki **WARDOGS**. Dystans, azymut, elewacja (mils) —
w dwa kliknięcia na mapie 16×16 km.

**Demo online:** https://djzet.github.io/wardogs-calc/

| Desktop | Mobile |
| :-: | :-: |
| ![desktop](assets/screenshots/desktop.png) | ![mobile](assets/screenshots/mobile.png) |

## Funkcje

- Interaktywna mapa z zoomem kafelkowym i panowaniem
- Obliczanie dystansu, azymutu i elewacji (mils)
- Moździerz (700 m) i artyleria (>2 km)
- Dwie mapy: Bakurani i Ozeti (16×16 km)
- Narzędzia rysowania: ołówek, linijka, marker, gumka
- Wieże i strefa na mapie Bakurani
- Linki do udostępniania szybkiego transferu współrzędnych
- Autozapis ustawień i punktów w localStorage
- Ciemne i jasne motywy
- 9 języków interfejsu (ru, en, de, fr, es, pl, uk, tr, zh)
- Responsywny design dla urządzeń mobilnych

## Szybki start

```bash
# Instalacja zależności
npm install

# Uruchomienie serwera deweloperskiego (http://localhost:5173)
npm run dev

# Budowanie dla produkcji (dist/)
npm run build

# Podgląd budowania (http://localhost:4173)
npm run preview
```

## Struktura projektu

```
wardogs-calc/
├── assets/           # Ikony i zrzuty ekranu
├── config/           # Ustawienia map i tabele balistyczne
├── js/
│   ├── core/         # Matematyka, współrzędne, kalkulator
│   ├── features/     # Przechowywanie, udostępnianie, punkty, bronie, analityka
│   ├── map/          # Kafelki, renderer, interakcje, kamera
│   ├── ui/           # Panele, pola wprowadzania, menu kontekstowe
│   ├── locales.js    # Menedżer lokalizacji (9 języków)
│   └── index.js      # Moduł główny: init, powiązanie zdarzeń
├── maps/             # Kafelki map (Bakurani, Ozeti)
├── public/           # Statyczne: locales, robots.txt, sitemap
├── src/main.js       # Punkt wejścia Vite
├── styles/           # CSS: zmienne, base, panel, map, mobile
├── index.html        # Główny markup
└── vite.config.js    # Konfiguracja Vite + wtyczka map
```

## Technologie

- **Vite** — narzędzie budowania i serwer dev
- **Vanilla JS** — bez frameworków (IIFE + window.*)
- **Canvas API** — renderowanie map i narzędzi rysowania
- **CSS Variables** — motywy

## Kontakt

- egor.silaev2003@yandex.ru
- [Wardogs CIS](https://discord.gg/kwxrTCJxre)
- @djzet

## Licencja

MIT © Egor Silaev
