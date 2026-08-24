// config/weapons.js — Данные оружия WARDOGS

window.CONFIG_WEAPONS = {
    default: 'mortar',
    weapons: {
        mortar: {
            id: 'mortar',
            names: {
                en: 'Mortar',
                ru: 'Миномёт',
                uk: 'Міномет',
                de: 'Mörser',
                fr: 'Mortier',
                es: 'Mortero',
                pl: 'Moździerz',
                tr: 'Havan',
                zh: '迫击炮',
            },
            minRangeKm: 0.110,
            maxRangeKm: 0.700,
            minElevationMil: 290,
            maxElevationMil: 900,
            step: 50,
            rangeColor: '#5ba8d3',
            table: [
                { mils: 290, dist: 700 },
                { mils: 340, dist: 650 },
                { mils: 390, dist: 600 },
                { mils: 440, dist: 550 },
                { mils: 490, dist: 500 },
                { mils: 540, dist: 450 },
                { mils: 590, dist: 400 },
                { mils: 640, dist: 350 },
                { mils: 690, dist: 300 },
                { mils: 700, dist: 290 },
                { mils: 750, dist: 240 },
                { mils: 800, dist: 187 },
                { mils: 850, dist: 132 },
                { mils: 900, dist: 110 },
            ]
        },
        artillery: {
            id: 'artillery',
            names: {
                en: 'Artillery',
                ru: 'Артиллерия',
                uk: 'Артилерія',
                de: 'Artillerie',
                fr: 'Artillerie',
                es: 'Artillería',
                pl: 'Artyleria',
                tr: 'Topçu',
                zh: '火炮',
            },

            minRangeKm: 2.138,
            maxRangeKm: 2.500,
            minElevationMil: 290,
            maxElevationMil: 1000,
            step: 10,
            rangeColor: '#5ba8d3',
            table: [
                { mils: 290, dist: 2500 },
                { mils: 900, dist: 2352 },
                { mils: 910, dist: 2331 },
                { mils: 920, dist: 2310 },
                { mils: 930, dist: 2289 },
                { mils: 940, dist: 2268 },
                { mils: 950, dist: 2247 },
                { mils: 960, dist: 2226 },
                { mils: 970, dist: 2204 },
                { mils: 980, dist: 2182 },
                { mils: 990, dist: 2160 },
                { mils: 1000, dist: 2138 },
            ]
        }
    }
};