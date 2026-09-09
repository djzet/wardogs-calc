window.CONFIG_APP = {
    maps: {
        bakurani: {
            id: 'bakurani',
            coordScale: 100,
            bounds: { minX: 23.35, maxX: 133.6, minY: 19.34, maxY: 129.65 },
            tileBounds: { minX: -0.03, maxX: 163.81, minY: -0.01, maxY: 163.83 },
            zone: { cx: 82.40, cy: 73.30, r: 0 },
            towers: [
                { x: 80.50, y: 69.86, name: 'tower1' },
                { x: 77.19, y: 70.00, name: 'tower2' },
                { x: 77.18, y: 73.46, name: 'tower3' },
                { x: 83.63, y: 72.86, name: 'tower4' },
                { x: 82.21, y: 68.43, name: 'tower5' },
            ],
            tiles: {
                mapId: 'bakurani',
                maxZoom: 7,
                minZoom: 0,
                tileSize: 256,
                extension: 'webp',
                cacheMax: 500,
                usePMTiles: false, // Изменено на false, так как мы используем обычные webp файлы
                path: (z, x, y) => {
                    const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname) || location.protocol === 'file:';
                    if (isLocal) {
                        // Для локальной разработки (папка maps должна лежать рядом с index.html)
                        return `maps/bakurani/tiles/zoom_${z}/${x}_${y}.webp`;
                    }
                    // Для GitHub Pages: прямой абсолютный URL на ваш репозиторий с картами
                    return `https://djzet.github.io/wardogs-maps/bakurani/tiles/zoom_${z}/${x}_${y}.webp`;
                },
            },
        },
        ozeti: {
            id: 'ozeti',
            coordScale: 100,
            bounds: { minX: 57.58, maxX: 143.07, minY: 21.81, maxY: 99.56 },
            tileBounds: { minX: -0.03, maxX: 163.81, minY: -0.01, maxY: 163.83 },
            zone: { cx: 80.00, cy: 80.00, r: 0 },
            towers: [],
            tiles: {
                mapId: 'ozeti',
                maxZoom: 7,
                minZoom: 0,
                tileSize: 256,
                extension: 'webp',
                cacheMax: 500,
                usePMTiles: false,
                path: (z, x, y) => {
                    const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname) || location.protocol === 'file:';
                    if (isLocal) {
                        return `maps/ozeti/tiles/zoom_${z}/${x}_${y}.webp`;
                    }
                    return `https://djzet.github.io/wardogs-maps/ozeti/tiles/zoom_${z}/${x}_${y}.webp`;
                },
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
};

window.CONFIG_WEAPONS = {
    default: 'mortar',
    weapons: {
        mortar: {
            id: 'mortar',
            names: {
                en: 'Mortar', ru: 'Миномёт', uk: 'Міномет', de: 'Mörser', fr: 'Mortier', es: 'Mortero', pl: 'Moździerz', tr: 'Havan', zh: '迫击炮',
            },
            minRangeKm: 0.132,
            maxRangeKm: 0.684,
            minElevationMil: 150,
            maxElevationMil: 850,
            step: 50,
            rangeColor: '#5ba8d3',
            table: [
                { mils: 150, dist: 684 }, { mils: 200, dist: 661 }, { mils: 250, dist: 637 }, { mils: 300, dist: 609 },
                { mils: 350, dist: 578 }, { mils: 400, dist: 545 }, { mils: 450, dist: 510 }, { mils: 500, dist: 470 },
                { mils: 550, dist: 430 }, { mils: 600, dist: 385 }, { mils: 650, dist: 340 }, { mils: 700, dist: 290 },
                { mils: 750, dist: 240 }, { mils: 800, dist: 187 }, { mils: 850, dist: 132 },
            ]
        },
        artillery: {
            id: 'artillery',
            names: {
                en: 'Artillery', ru: 'Артиллерия', uk: 'Артилерія', de: 'Artillerie', fr: 'Artillerie', es: 'Artillería', pl: 'Artyleria', tr: 'Topçu', zh: '火炮',
            },
            minRangeKm: 0.786,
            maxRangeKm: 2.679,
            minElevationMil: 600,
            maxElevationMil: 1390,
            step: 10,
            rangeColor: '#5ba8d3',
            table: [
                { mils: 600, dist: 2679 }, { mils: 650, dist: 2669 }, { mils: 700, dist: 2644 }, { mils: 750, dist: 2602 },
                { mils: 800, dist: 2545 }, { mils: 850, dist: 2473 }, { mils: 900, dist: 2386 }, { mils: 950, dist: 2284 },
                { mils: 1000, dist: 2168 }, { mils: 1050, dist: 2037 }, { mils: 1100, dist: 1892 }, { mils: 1150, dist: 1733 },
                { mils: 1200, dist: 1560 }, { mils: 1250, dist: 1374 }, { mils: 1300, dist: 1175 }, { mils: 1350, dist: 963 },
                { mils: 1390, dist: 786 }
            ]
        }
    }
};