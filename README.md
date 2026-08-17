<div align="center">

# 🎯 WARDOGS — Mortar & Artillery Calculator

### Unofficial interactive mortar / artillery calculator for the tactical shooter **WARDOGS**

**[🚀 Live Demo](https://djzet.github.io/wardogs-calc/)** · **[💬 Discord (CIS)](https://discord.gg/kwxrTCJxre)** · **[🐛 Report a bug](https://github.com/djzet/wardogs-calc/issues)**

[![Website](https://img.shields.io/badge/website-djzet.github.io-9fd356?style=for-the-badge)](https://djzet.github.io/wardogs-calc/)
[![Discord](https://img.shields.io/badge/Discord-Wardogs%20CIS-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/kwxrTCJxre)
[![Stars](https://img.shields.io/github/stars/djzet/wardogs-calc?style=for-the-badge)](https://github.com/djzet/wardogs-calc/stargazers)
[![Last Commit](https://img.shields.io/github/last-commit/djzet/wardogs-calc?style=for-the-badge)](https://github.com/djzet/wardogs-calc/commits/main/)
[![License](https://img.shields.io/github/license/djzet/wardogs-calc?style=for-the-badge)](https://github.com/djzet/wardogs-calc/blob/main/LICENSE)

*Distance · Azimuth · Elevation (mils) · Flight time — in two clicks on an interactive 16×16 km map.*

</div>

---

<p align="center">
  <img src="docs/screenshots/desktop.png" alt="WARDOGS mortar calculator — desktop view" width="720">
</p>

<details>
<summary>🇷🇺 Описание на русском</summary>

**WARDOGS Mortar Calculator** — неофициальный фанатский калькулятор миномётного и артиллерийского расчёта для игры WARDOGS. Ставишь точку A (своя позиция) и точку B (цель) — получаешь дистанцию, азимут, угол возвышения в mils и время подлёта снаряда. Работает в браузере на телефоне и компьютере, поддерживает 9 языков.

👉 **Попробовать: [djzet.github.io/wardogs-calc](https://djzet.github.io/wardogs-calc/)**

</details>

---

## Contents

- [Features](#features)
- [Screenshots](#screenshots)
- [Weapon Data](#weapon-data)
- [How to Use](#how-to-use)
- [How It Works](#how-it-works)
- [Languages](#languages)
- [Run Locally](#run-locally)
- [Roadmap](#roadmap)
- [FAQ](#faq)
- [Contributing](#contributing)
- [Disclaimer](#disclaimer)
- [Contact](#contact)
- [License](#license)

---

## Features

- 🗺️ **Interactive 16×16 km map** — tiled zoom, pan, custom canvas renderer
- 📍 **Point A / Point B** — set by right-click, drag & drop, or manual % coordinates
- 📏 **Instant calculations** — distance, azimuth (from north), elevation in **mils**, flight time
- 🔭 **Two weapon modes** — Mortar (up to 700 m) and Artillery (up to 2.5 km) with in-game data tables
- ⭕ **Range circle** visualization for the selected weapon
- 🗼 **Tower landmarks** toggle for quick orientation
- 🔗 **Shareable links** — send coordinates + weapon to your squad in one URL
- 💾 **Auto-save** — points, weapon and camera view restored after reload
- 🌍 **9 languages** — RU, EN, DE, FR, ES, PL, UK, TR, ZH
- 🌗 **Dark / Light theme**
- 📱 **Mobile friendly** — pinch-zoom, long-press menu, touch dragging

---

## Screenshots

| Desktop | Mobile |
|:---:|:---:|
| <img src="docs/screenshots/desktop.png" width="360" alt="WARDOGS calculator desktop"> | <img src="docs/screenshots/mobile.png" width="200" alt="WARDOGS calculator mobile"> |

---

## Weapon Data

### Mortar (max 700 m)

| Mils | Dist (m) | | Mils | Dist (m) |
|-----:|-----:|:---:|-----:|-----:|
| 290 | 700 | | 700 | 290 |
| 340 | 650 | | 750 | 240 |
| 390 | 600 | | 800 | 187 |
| 440 | 550 | | 850 | 132 |
| 490 | 500 | | 900 | 110 |
| 540 | 450 | | | |
| 590 | 400 | | | |
| 640 | 350 | | | |
| 690 | 300 | | | |

### Artillery (max 2 500 m)

| Mils | Dist (m) |
|-----:|-----:|
| 290 | 2500 |
| 900 | 2352 |
| 950 | 2247 |
| 1000 | 2138 |

*Full tables with linear interpolation between measured points are built into the calculator.*

---

## How to Use

1. Open the [live app](https://djzet.github.io/wardogs-calc/).
2. **Right-click** the map → set **📍 Position (A)** (your mortar) and **🎯 Target (B)**.
   *(On mobile: long-press the map.)*
3. Read the results panel: **distance**, **azimuth**, **elevation (mils)**, **flight time**.
4. Dial the mils value on your sight and fire. 💥
5. Press **Share** to copy a link with coordinates for your squad.

> Coordinates are entered as **percent of the map (0–100)** — the same grid players call out in voice chat.

---

## How It Works

- **Azimuth** — `atan2(dx, dy)`, measured clockwise from true north (0° = N).
- **Elevation** — linear interpolation between in-game mils/distance points, snapped to the sight step (mortar: 50, artillery: 10).
- **Flight time** — `t = d / (v₀ · cos θ)`, where θ is barrel elevation in radians.
- **Map** — custom canvas renderer with a tile pyramid (`zoom_0…zoom_5`), LRU tile cache and HiDPI support.

---

## Languages

🇷🇺 Русский · 🇬🇧 English · 🇩🇪 Deutsch · 🇫🇷 Français · 🇪🇸 Español · 🇵🇱 Polski · 🇺🇦 Українська · 🇹🇷 Türkçe · 🇨🇳 中文

*Interface language switches instantly and is saved between sessions.*

---

## FAQ

**Is this an official tool?**
No. It is a community fan project and is not affiliated with the WARDOGS developers.

**Is it safe to use?**
Yes. The calculator runs in your browser and never touches the game client or its memory — it's as safe as using a paper map and a pencil.

**How accurate are the tables?**
Tables are based on community-measured in-game data. Between measured points the calculator uses linear interpolation.

**Why does it say "out of range"?**
The target is beyond the weapon's maximum range (700 m for mortar, 2.5 km for artillery).

**Does it work on phones?**
Yes — one finger pans, two fingers zoom, long-press opens the point menu.

---

## Contributing

Contributions are welcome! Feel free to:

- 🐛 [Report bugs](https://github.com/djzet/wardogs-calc/issues)
- 🌍 Improve translations
- 📊 Help refine weapon data tables
- ⭐ Star the repo to support the project

---

## Disclaimer

This is an **unofficial fans-made tool** for the game WARDOGS.
Not affiliated with, endorsed, or sponsored by the game developers.
All game data and trademarks belong to their respective owners.

---

## Contact

- 📧 Email: [egor.silaev2003@yandex.ru](mailto:egor.silaev2003@yandex.ru)
- 💬 Discord: [Wardogs СНГ / CIS](https://discord.gg/kwxrTCJxre)
- 🐙 GitHub: [@djzet](https://github.com/djzet)

---

## License

MIT © [Egor Silaev](https://github.com/djzet)

---

<div align="center">

[![Star History Chart](https://api.star-history.com/svg?repos=djzet/wardogs-calc&type=Date)](https://star-history.com/#djzet/wardogs-calc&Date)

**If this tool helped your squad land a few mortars — give it a ⭐!**

</div>