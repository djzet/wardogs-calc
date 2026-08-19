# Руководство для разработчиков

## Локальный запуск

Проект — статический сайт, сборка не требуется. Любой локальный сервер:

```bash
# Python
python -m http.server 8000

# Node
npx serve .
```

Или расширение **Live Server** в VSCode. Открой `http://localhost:8000`.

> **Важно:** не открывай `index.html` двойным кликом (`file://`) — `fetch()` переводов блокируется браузером.

## Структура проекта

```
wardogs-calc/
├── config/
│   ├── app.js              # карта, зона, вышки, тайлы, тайминги
│   └── weapons.js          # оружие: таблицы mils/dist, диапазоны, имена
├── js/
│   ├── core/               # utils (математика), calculator (расчёты)
│   ├── features/           # storage, share, points, analytics, weapons
│   ├── map/                # tiles, renderer, interactions, viewport
│   ├── ui/                 # panels, inputs, contextMenu, results
│   ├── locales/            # index.js (менеджер) + 9 JSON-переводов
│   └── index.js            # координация модулей (~140 строк)
├── maps/tiles/zoom_0..5/   # пирамида тайлов карты
├── styles/                 # 6 CSS-модулей
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