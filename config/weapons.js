// config/weapons.js — Данные оружия WARDOGS (улучшенная версия)

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
                pt: 'Morteiro',
                cat: 'MEOWTAR'
            },

            // Диапазоны (в км для удобства, конвертируем в метры при использовании)
            minRangeKm: 0.132,
            maxRangeKm: 0.684,

            // Диапазоны углов возвышения
            minElevationMil: 150,
            maxElevationMil: 900,

            // Параметры расчёта
            step: 50,
            v0: 290 / (22 * Math.cos(700 / 1000)),
            rangeColor: '#5ba8d3',

            // Таблица для точной интерполяции (наша фича)
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
                pt: 'Artilharia',
                cat: 'Artilleria'
            },

            minRangeKm: 0.78,
            maxRangeKm: 2.629,

            minElevationMil: 30,
            maxElevationMil: 610,

            step: 10,
            v0: 2500 / (12 * Math.cos(290 / 1000)),
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