# WARDOGS — Calculateur de Mortier et d'Artillerie | Carte Interactive 16×16 km

[Русский](README.md) · [English](README.en.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Español](README.es.md) · [Polski](README.pl.md) · [Українська](README.uk.md) · [Türkçe](README.tr.md) · [中文](README.zh.md)

Calculateur interactif non officiel de mortier et d'artillerie pour le shooter
tactique **WARDOGS**. Distance, azimut, élévation (mils) —
en deux clics sur une carte de 16×16 km.

**Démo en ligne :** https://djzet.github.io/wardogs-calc/

| Desktop | Mobile |
| :-: | :-: |
| ![desktop](assets/screenshots/desktop.png) | ![mobile](assets/screenshots/mobile.png) |

## Fonctionnalités

- Carte interactive avec zoom tuilé et pan
- Calcul de distance, azimut et élévation (mils)
- Mortier (700 m) et artillerie (>2 km)
- Deux cartes : Bakurani et Ozeti (16×16 km)
- Outils de dessin : crayon, règle, marqueur, gomme
- Tours et zone sur la carte Bakurani
- Liens de partage pour transfert rapide des coordonnées
- Sauvegarde automatique des paramètres et points dans localStorage
- Thèmes sombre et clair
- 9 langues d'interface (ru, en, de, fr, es, pl, uk, tr, zh)
- Design responsive pour appareils mobiles

## Démarrage rapide

```bash
# Installation des dépendances
npm install

# Démarrer le serveur dev (http://localhost:5173)
npm run dev

# Compilation pour la production (dist/)
npm run build

# Aperçu de la compilation (http://localhost:4173)
npm run preview
```

## Structure du projet

```
wardogs-calc/
├── assets/           # Icônes et captures d'écran
├── config/           # Paramètres de carte et tables balistiques
├── js/
│   ├── core/         # Mathématiques, coordonnées, calculateur
│   ├── features/     # Stockage, partage, points, armes, analytiques
│   ├── map/          # Tuiles, moteur de rendu, interactions, caméra
│   ├── ui/           # Panneaux, champs de saisie, menu contextuel
│   ├── locales.js    # Gestionnaire de localisation (9 langues)
│   └── index.js      # Module principal : init, liaison des événements
├── maps/             # Tuiles de carte (Bakurani, Ozeti)
├── public/           # Statique : locales, robots.txt, sitemap
├── src/main.js       # Point d'entrée Vite
├── styles/           # CSS : variables, base, panel, map, mobile
├── index.html        # Markup principal
└── vite.config.js    # Configuration Vite + plugin carte
```

## Technologies

- **Vite** — outil de build et serveur dev
- **Vanilla JS** — sans frameworks (IIFE + window.*)
- **Canvas API** — rendu de carte et outils de dessin
- **CSS Variables** — thématisation

## Contact

- egor.silaev2003@yandex.ru
- [Wardogs CIS](https://discord.gg/kwxrTCJxre)
- @djzet

## Licence

MIT © Egor Silaev
