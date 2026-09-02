# WARDOGS — Миномётный и артиллерийский калькулятор

[Русский](README.md) · [English](README.en.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Español](README.es.md) · [Polski](README.pl.md) · [Українська](README.uk.md) · [Türkçe](README.tr.md) · [中文](README.zh.md)

Неофициальный интерактивный калькулятор миномёта и артиллерии для тактического
шутера **WARDOGS**. Дистанция, азимут, угол возвышения (mils) —
в два клика по карте 16×16 км.

**Live Demo:** https://djzet.github.io/wardogs-calc/

| Desktop | Mobile |
| :-: | :-: |
| ![desktop](assets/screenshots/desktop.png) | ![mobile](assets/screenshots/mobile.png) |

## Возможности

- Интерактивная карта с тайловым зумом и панорамированием
- Расчёт дистанции, азимута и угла возвышения (mils)
- Миномёт (700 м) и артиллерия (>2 км)
- Две карты: Bakurani и Ozeti (16×16 км)
- Инструменты рисования: карандаш, линейка, метка, ластик
- Вышки и зона на карте Bakurani
- Share-ссылки для быстрой передачи координат
- Автосохранение настроек и точек в localStorage
- Тёмная и светлая темы
- 9 языков интерфейса (ru, en, de, fr, es, pl, uk, tr, zh)
- Адаптивный дизайн для мобильных устройств

## Быстрый старт

```bash
# Установка зависимостей
npm install

# Запуск dev-сервера (http://localhost:5173)
npm run dev

# Сборка для продакшена (dist/)
npm run build

# Предпросмотр сборки (http://localhost:4173)
npm run preview
```

## Структура проекта

```
wardogs-calc/
├── assets/           # Иконки и скриншоты
├── config/           # Настройки карт и баллистические таблицы
├── js/
│   ├── core/         # Математика, координаты, калькулятор
│   ├── features/     # Хранение, шаринг, точки, оружие, аналитика
│   ├── map/          # Тайлы, рендерер, взаимодействия, камера
│   ├── ui/           # Панели, поля ввода, контекстное меню
│   ├── locales.js    # Менеджер локализации (9 языков)
│   └── index.js      # Главный модуль: init, привязка событий
├── maps/             # Тайлы карт (Bakurani, Ozeti)
├── public/           # Статика: локали, robots.txt, sitemap
├── src/main.js       # Точка входа Vite
├── styles/           # CSS: переменные, base, panel, map, mobile
├── index.html        # Основная разметка
└── vite.config.js    # Конфигурация Vite + плагин карт
```

## Технологии

- **Vite** — сборка и dev-сервер
- **Vanilla JS** — без фреймворков (IIFE + window.*)
- **Canvas API** — рендеринг карты и инструментов рисования
- **CSS Variables** — темизация

## Контакты

- egor.silaev2003@yandex.ru
- [Wardogs СНГ / CIS](https://discord.gg/kwxrTCJxre)
- @djzet

## Лицензия

MIT © Egor Silaev
