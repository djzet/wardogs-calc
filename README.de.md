# WARDOGS — Mörser- & Artillerie-Rechner | Interaktive 16×16 km Karte

[Русский](README.md) · [English](README.en.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Español](README.es.md) · [Polski](README.pl.md) · [Українська](README.uk.md) · [Türkçe](README.tr.md) · [中文](README.zh.md)

Inoffizieller interaktiver Mörser- und Artillerie-Rechner für den Taktik-Shooter
**WARDOGS**. Distanz, Azimut, Erhöhung (mils) — mit zwei Klicks
auf der 16×16-km-Karte.

**Live-Demo:** https://djzet.github.io/wardogs-calc/

| Desktop | Mobil |
| :-: | :-: |
| ![desktop](assets/screenshots/desktop.png) | ![mobile](assets/screenshots/mobile.png) |

## Funktionen

- Interaktive Karte mit Kachel-Zoom und Pan
- Berechnung von Distanz, Azimut und Erhöhung (mils)
- Mörser (700 m) und Artillerie (>2 km)
- Zwei Karten: Bakurani und Ozeti (16×16 km)
- Zeichnungswerkzeuge: Stift, Lineal, Marker, Radiergummi
- Türme und Zone auf der Bakurani-Karte
- Share-Links zur schnellen Koordinatenübertragung
- Auto-Speicherung von Einstellungen und Punkten im localStorage
- Dunkle und helle Themen
- 9 Featuring-Sprachen (ru, en, de, fr, es, pl, uk, tr, zh)
- Responsives Design für mobile Geräte

## Schnellstart

```bash
# Abhängigkeiten installieren
npm install

# Dev-Server starten (http://localhost:5173)
npm run dev

# Für Produktion bauen (dist/)
npm run build

# Build-Vorschau (http://localhost:4173)
npm run preview
```

## Projektstruktur

```
wardogs-calc/
├── assets/           # Icons und Screenshots
├── config/           # Karteneinstellungen und ballistische Tabellen
├── js/
│   ├── core/         # Mathematik, Koordinaten, Rechner
│   ├── features/     # Speicher, Sharing, Punkte, Waffen, Analytik
│   ├── map/          # Kacheln, Renderer, Interaktionen, Kamera
│   ├── ui/           # Panels, Eingaben, Kontextmenü
│   ├── locales.js    # Lokalisierungsmanager (9 Sprachen)
│   └── index.js      # Hauptmodul: Init, Event-Bindung
├── maps/             # Kacheln (Bakurani, Ozeti)
├── public/           # Statisch: Lokalisierungen, robots.txt, sitemap
├── src/main.js       # Vite-Einstiegspunkt
├── styles/           # CSS: Variablen, base, panel, map, mobile
├── index.html        # Haupt-Markup
└── vite.config.js    # Vite-Konfiguration + Karten-Plugin
```

## Technologien

- **Vite** — Build-Tool und Dev-Server
- **Vanilla JS** — ohne Frameworks (IIFE + window.*)
- **Canvas API** — Kartenrendering und Zeichnungswerkzeuge
- **CSS Variables** — Theming

## Kontakt

- egor.silaev2003@yandex.ru
- [Wardogs CIS](https://discord.gg/kwxrTCJxre)
- @djzet

## Lizenz

MIT © Egor Silaev
