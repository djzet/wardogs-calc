# WARDOGS — Калькулятор міномета та артилерії

[Русский](README.md) · [English](README.en.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Español](README.es.md) · [Polski](README.pl.md) · [Українська](README.uk.md) · [Türkçe](README.tr.md) · [中文](README.zh.md)

Неофіційний інтерактивний калькулятор міномета та артилерії для тактичного
шутера **WARDOGS**. Дистанція, азимут, кут підвищення (mils) —
у два кліки по карті 16×16 км.

**Live Demo:** https://djzet.github.io/wardogs-calc/

| Desktop | Mobile |
| :-: | :-: |
| ![desktop](assets/screenshots/desktop.png) | ![mobile](assets/screenshots/mobile.png) |

## Можливості

- Інтерактивна карта з тайловим зумом і панорамуванням
- Обчислення дистанції, азимута та кута підвищення (mils)
- Міномет (700 м) і артилерія (>2 км)
- Дві карти: Bakurani та Ozeti (16×16 км)
- Інструменти малювання: олівець, лінійка, маркер, гумка
- Вежі та зона на карті Bakurani
- Посилання для швидкого передавання координат
- Автозбереження налаштувань і точок у localStorage
- Темна та світла теми
- 9 мов інтерфейсу (ru, en, de, fr, es, pl, uk, tr, zh)
- Адаптивний дизайн для мобільних пристроїв

## Швидкий старт

```bash
# Встановлення залежностей
npm install

# Запуск dev-сервера (http://localhost:5173)
npm run dev

# Збірка для продакшену (dist/)
npm run build

# Попередній перегляд збірки (http://localhost:4173)
npm run preview
```

## Структура проекту

```
wardogs-calc/
├── assets/           # Іконки та скріншоти
├── config/           # Налаштування карт та балістичні таблиці
├── js/
│   ├── core/         # Математика, координати, калькулятор
│   ├── features/     # Зберігання, шаринг, точки, зброя, аналітика
│   ├── map/          # Тайли, рендерер, взаємодії, камера
│   ├── ui/           # Панелі, поля введення, контекстне меню
│   ├── locales.js    # Менеджер локалізації (9 мов)
│   └── index.js      # Головний модуль: init, прив'язка подій
├── maps/             # Тайли карт (Bakurani, Ozeti)
├── public/           # Статичне: локалі, robots.txt, sitemap
├── src/main.js       # Точка входу Vite
├── styles/           # CSS: змінні, base, panel, map, mobile
├── index.html        # Основна розмітка
└── vite.config.js    # Конфігурація Vite + плагін карт
```

## Технології

- **Vite** — збірка та dev-сервер
- **Vanilla JS** — без фреймворків (IIFE + window.*)
- **Canvas API** — рендеринг карт та інструментів малювання
- **CSS Variables** — теми

## Контакти

- egor.silaev2003@yandex.ru
- [Wardogs CIS](https://discord.gg/kwxrTCJxre)
- @djzet

## Ліцензія

MIT © Egor Silaev
