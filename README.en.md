# WARDOGS — Mortar & Artillery Calculator

[Русский](README.md) · [English](README.en.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Español](README.es.md) · [Polski](README.pl.md) · [Українська](README.uk.md) · [Türkçe](README.tr.md) · [中文](README.zh.md)

Unofficial interactive mortar and artillery calculator for the tactical shooter
**WARDOGS**. Distance, azimuth, elevation (mils) — in two clicks
on a 16×16 km map.

**Live Demo:** https://djzet.github.io/wardogs-calc/

| Desktop | Mobile |
| :-: | :-: |
| ![desktop](assets/screenshots/desktop.png) | ![mobile](assets/screenshots/mobile.png) |

## Features

- Interactive map with tile zoom and pan
- Distance, azimuth, and elevation (mils) calculation
- Mortar (700 m) and artillery (>2 km)
- Two maps: Bakurani and Ozeti (16×16 km)
- Drawing tools: pen, ruler, marker, eraser
- Towers and zone on Bakurani map
- Share links for quick coordinate transfer
- Auto-save settings and points to localStorage
- Dark and light themes
- 9 interface languages (ru, en, de, fr, es, pl, uk, tr, zh)
- Responsive design for mobile devices

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:5173)
npm run dev

# Build for production (dist/)
npm run build

# Preview build (http://localhost:4173)
npm run preview
```

## Project Structure

```
wardogs-calc/
├── assets/           # Icons and screenshots
├── config/           # Map settings and ballistic tables
├── js/
│   ├── core/         # Math, coordinates, calculator
│   ├── features/     # Storage, sharing, points, weapons, analytics
│   ├── map/          # Tiles, renderer, interactions, camera
│   ├── ui/           # Panels, inputs, context menu
│   ├── locales.js    # Localization manager (9 languages)
│   └── index.js      # Main module: init, event binding
├── maps/             # Map tiles (Bakurani, Ozeti)
├── public/           # Static: locales, robots.txt, sitemap
├── src/main.js       # Vite entry point
├── styles/           # CSS: variables, base, panel, map, mobile
├── index.html        # Main markup
└── vite.config.js    # Vite configuration + map plugin
```

## Tech Stack

- **Vite** — build tool and dev server
- **Vanilla JS** — no frameworks (IIFE + window.*)
- **Canvas API** — map rendering and drawing tools
- **CSS Variables** — theming

## Contact

- egor.silaev2003@yandex.ru
- [Wardogs CIS](https://discord.gg/kwxrTCJxre)
- @djzet

## License

MIT © Egor Silaev
