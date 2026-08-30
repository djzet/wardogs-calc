# Руководство для разработчиков

## Локальный запуск (Vite)

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # → dist/ (base = /wardogs-calc/)
npm run preview      # проверка production-сборки
```

> **Важно:** не открывай `index.html` через `file://` — `fetch()` переводов блокируется.

## Деплой (GitHub Pages)

Workflow `.github/workflows/deploy.yml`: push в `main` → `npm run build` → publish `dist/`.  
Сайт: https://djzet.github.io/wardogs-calc/

В настройках репозитория: **Settings → Pages → Source: GitHub Actions**.

## Структура проекта

```
wardogs-calc/
├── src/main.js             # entry Vite (импорт CSS + всех JS)
├── public/                 # статика as-is → корень dist
│   ├── assets/             # иконки, preview
│   ├── locales/            # *.json переводов
│   ├── robots.txt
│   └── sitemap.xml
├── config/                 # app.js, weapons.js
├── js/                     # core, features, map, ui, locales, index.js
├── maps/                   # тайлы (dev middleware + copy в dist)
├── styles/                 # CSS (импорт из main.js)
├── vite.config.js          # base: /wardogs-calc/
├── package.json
└── index.html
```


## Архитектура

Каждый модуль — IIFE, экспортирующий объект в `window.*`:

| Модуль            | Ответственность                         |
| ----------------- | --------------------------------------- |
| `AppUtils`        | Чистая математика, конвертеры координат |
| `AppCalculator`   | Расчёт дистанции/азимута/mils/времени   |
| `AppPoints`       | Владение точками A/B, события изменений |
| `AppStorage`      | Обёртка над localStorage                |
| `AppShare`        | Share-ссылки, clipboard, toast          |
| `AppWeapons`      | Выбор оружия                            |
| `AppAnalytics`    | События Метрики/GA                      |
| `MapTiles`        | Загрузка тайлов с LRU-кэшем             |
| `MapRenderer`     | Вся отрисовка canvas                    |
| `MapViewport`     | Камера: view, resize, reset             |
| `MapInteractions` | Pointer/pinch/wheel события             |
| `UIPanels`        | Drawer, help, темы, вышки               |
| `UIInputs`        | Координатные поля                       |
| `UIContextMenu`   | Контекстное меню карты                  |
| `UIResults`       | Панель результатов                      |
| `LocaleManager`   | Загрузка и применение переводов         |

## Как добавить оружие

1. Открой `config/weapons.js`
2. Добавь объект в `weapons` по образцу `mortar`:
   - `id`, `names` (переводы), `minRangeKm`, `maxRangeKm`
   - `step` (шаг прицела), `v0`, `rangeColor`
   - `table` — измеренные пары `{ mils, dist }` по убыванию dist
3. Добавь radio-кнопку в `index.html` (блок `radio-group`)

## Как добавить язык

См. `docs/localization.md`.

## Как добавить карту

1. Нарезь тайлы 256×256 в `maps/tiles/zoom_N/x_y.webp`
2. Настрой `config/app.js`: `map.size`, `tiles.maxZoom`, `zone`, `towers`

## Деплой

GitHub Pages через `.github/workflows/static.yml` — автоматически при push в `main`.