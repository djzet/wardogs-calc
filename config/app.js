// config/app.js — Общие настройки приложения

window.CONFIG_APP = {
    map: {
        size: 16000, // размер карты в метрах (16×16 км)
    },

    zone: {
        cx: 8240,
        cy: 7330,
        r: 1000,
    },

    towers: [
        { x: 51.59, y: 44.61, name: 'tower1' },
        { x: 47.86, y: 44.77, name: 'tower2' },
        { x: 47.86, y: 48.62, name: 'tower3' },
        { x: 55.07, y: 48.00, name: 'tower4' },
        { x: 53.50, y: 43.01, name: 'tower5' },
    ],

    tiles: {
        maxZoom: 5,
        size: 256,
        cacheMax: 500,
        path: (z, x, y) => `maps/tiles/zoom_${z}/${x}_${y}.webp`,
    },

    timing: {
        inputDebounceMs: 80,
        tapThreshold: 5,
        longPressMs: 500,
    },

    defaultWeapon: 'mortar',
    defaultTheme: 'dark',
};