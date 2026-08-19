# Локализация

## Поддерживаемые языки

🇷🇺 ru · 🇬🇧 en · 🇩🇪 de · 🇫🇷 fr · 🇪🇸 es · 🇵🇱 pl · 🇺🇦 uk · 🇹 tr · 🇳 zh

Выбор сохраняется в `localStorage` и восстанавливается при загрузке.

## Как добавить язык

1. Создай `js/locales/xx.json` — скопируй структуру `en.json`
2. Переведи все ключи
3. Добавь код в `SUPPORTED_LOCALES` в `js/locales/index.js`
4. Добавь `<option value="xx">` в `#langSelect` в `index.html`
5. Добавь `<link rel="alternate" hreflang="xx">` в `<head>`

## Структура JSON

Плоские ключи для UI + вложенный объект `weaponNames`:

```json
{
    "title": "Mortar Calculator",
    "oor": "out of range",
    "weaponNames": { "mortar": "Mortar", "artillery": "Artillery" }
}
```

Доступ к вложенным ключам: `LocaleManager.t('weaponNames.mortar')`.

## HTML-ключи

Ключи `hint`, `helpP1`…`helpP6` применяются через `innerHTML`
(разрешён `<b>` и `<br>`). Остальные — через `textContent`.

## Динамические ключи

`oor`, `tooClose`, `zero`, `u_m`, `u_km`, `u_s`, `u_mil`,
`tower1`…`tower5`, `share*` — используются в canvas-отрисовке
и toast, читаются через `STR.*`.