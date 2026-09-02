# WARDOGS — Calculadora de Mortero y Artillería | Mapa Interactivo 16×16 km

[Русский](README.md) · [English](README.en.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Español](README.es.md) · [Polski](README.pl.md) · [Українська](README.uk.md) · [Türkçe](README.tr.md) · [中文](README.zh.md)

Calculadora interactiva no oficial de mortero y artillería para el shooter
táctico **WARDOGS**. Distancia, azimut, elevación (mils) —
en dos clics sobre un mapa de 16×16 km.

**Demo en línea:** https://djzet.github.io/wardogs-calc/

| Desktop | Móvil |
| :-: | :-: |
| ![desktop](assets/screenshots/desktop.png) | ![mobile](assets/screenshots/mobile.png) |

## Características

- Mapa interactivo con zoom de mosaicos y pan
- Cálculo de distancia, azimut y elevación (mils)
- Mortero (700 m) y artillería (>2 km)
- Dos mapas: Bakurani y Ozeti (16×16 km)
- Herramientas de dibujo: lápiz, regla, marcador, borrador
- Torres y zona en el mapa Bakurani
- Enlaces para compartir y transferencia rápida de coordenadas
- Autoguardado de configuración y puntos en localStorage
- Temas oscuro y claro
- 9 idiomas de interfaz (ru, en, de, fr, es, pl, uk, tr, zh)
- Diseño responsivo para dispositivos móviles

## Inicio rápido

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo (http://localhost:5173)
npm run dev

# Compilar para producción (dist/)
npm run build

# Previsualizar compilación (http://localhost:4173)
npm run preview
```

## Estructura del proyecto

```
wardogs-calc/
├── assets/           # Iconos y capturas de pantalla
├── config/           # Configuración de mapas y tablas balísticas
├── js/
│   ├── core/         # Matemáticas, coordenadas, calculadora
│   ├── features/     # Almacenamiento, compartición, puntos, armas, analíticas
│   ├── map/          # Mosaicos, motor de renderizado, interacciones, cámara
│   ├── ui/           # Paneles, campos de entrada, menú contextual
│   ├── locales.js    # Gestor de localización (9 idiomas)
│   └── index.js      # Módulo principal: init, enlace de eventos
├── maps/             # Mosaicos de mapa (Bakurani, Ozeti)
├── public/           # Estático: locales, robots.txt, sitemap
├── src/main.js       # Punto de entrada Vite
├── styles/           # CSS: variables, base, panel, map, mobile
├── index.html        # Markup principal
└── vite.config.js    # Configuración Vite + plugin de mapa
```

## Tecnologías

- **Vite** — herramienta de compilación y servidor dev
- **Vanilla JS** — sin frameworks (IIFE + window.*)
- **Canvas API** — renderizado de mapas y herramientas de dibujo
- **CSS Variables** — tematización

## Contacto

- egor.silaev2003@yandex.ru
- [Wardogs CIS](https://discord.gg/kwxrTCJxre)
- @djzet

## Licencia

MIT © Egor Silaev
