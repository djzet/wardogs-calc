// config/app.js — Общие настройки приложения

window.CONFIG_APP = {
    maps: {
        bakurani: {
            id: 'bakurani',
            size: 16000,
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
                mapId: 'bakurani',
                maxZoom: 5,
                size: 256,
                cacheMax: 500,
                path: (z, x, y) => `maps/bakurani/tiles/zoom_${z}/${x}_${y}.webp`,
            },
        },
        ozeti: {
            id: 'ozeti',
            size: 16000,
            zone: {
                cx: 8000,
                cy: 8000,
                r: 0,
            },
            towers: [],
            tiles: {
                mapId: 'ozeti',
                maxZoom: 5,
                size: 256,
                cacheMax: 500,
                path: (z, x, y) => `maps/ozeti/tiles/zoom_${z}/${x}_${y}.webp`,
            },
        },
    },
    defaultMap: 'bakurani',
    timing: {
        inputDebounceMs: 80,
        tapThreshold: 5,
        longPressMs: 500,
    },
    defaultWeapon: 'mortar',
    defaultTheme: 'dark',
};
