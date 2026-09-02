/**
 *
 * Определяет:
 * - Базовый путь ('./' — работает и на GH Pages, и локально)
 * - Кастомный плагин mapsPlugin для раздачи тайлов карты
 *   в dev-режиме и копирования в dist при сборке
 * - Порты dev-сервера (5173) и preview (4173)
 */

import { defineConfig } from 'vite';
import { cpSync, createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Корневая директория проекта (вместо __dirname в ESM) */
const root = dirname(fileURLToPath(import.meta.url));

/** Папка с тайлами карты в исходниках */
const mapsSrc = join(root, 'maps');

/** MIME-типы для раздачи статических файлов карт */
const MIME = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.json': 'application/json',
};

/**
 * Кастомный Vite-плагин для раздачи тайлов карты.
 *
 * В dev-режиме: добавляет middleware, который раздаёт файлы из maps/
 * по маршруту /maps/... с правильными MIME-типами и кэшированием.
 * В продакшене: копирует всю папку maps/ в dist/maps/ после сборки.
 *
 * @returns {object} Vite-плагин с configureServer и closeBundle
 */
function mapsPlugin() {
  return {
    name: 'wardogs-maps',

    /**
     * Middleware dev-сервера: раздаёт файлы из maps/ по HTTP.
     * Защита от path traversal: проверяет что путь начинается с mapsSrc.
     */
    configureServer(server) {
      server.middlewares.use('/maps', (req, res, next) => {
        try {
          /** Декодируем URL и убираем leading slashes */
          const rel = decodeURIComponent((req.url || '/').split('?')[0]).replace(/^\/+/, '');
          const filePath = join(mapsSrc, rel);

          /** Защита от path traversal и пропуск директорий */
          if (!filePath.startsWith(mapsSrc) || !existsSync(filePath) || statSync(filePath).isDirectory()) {
            res.statusCode = 404;
            res.end('Not found');
            return;
          }

          /** Устанавливаем MIME-тип и кэш на 1 день */
          res.setHeader('Content-Type', MIME[extname(filePath)] || 'application/octet-stream');
          res.setHeader('Cache-Control', 'public, max-age=86400');

          /** Потоковая отдача файла (эффективно для больших тайлов) */
          createReadStream(filePath).pipe(res);
        } catch (e) {
          next(e);
        }
      });
    },

    /**
     * Хук сборки: копирует папку maps/ в dist/maps/ после bundle.
     * Вызывается после завершения формирования бандла.
     */
    closeBundle() {
      const distMaps = join(root, 'dist', 'maps');
      mkdirSync(join(root, 'dist'), { recursive: true });
      console.log('[wardogs-maps] copying maps/ → dist/maps …');
      cpSync(mapsSrc, distMaps, { recursive: true });
      console.log('[wardogs-maps] done');
    },
  };
}

/**
 * Vite-плагин: инлайнинг локализации.
 *
 * Собирает ВСЕ JSON-файлы из public/locales/ и встраивает их
 * в JS-бандл как виртуальный модуль 'virtual:locale-data'.
 *
 * В dev-режиме: экспортирует null → locales.js продолжает использовать fetch(),
 *   чтобы правки JSON отслеживались без перезапуска dev-сервера.
 * В build-режиме: экспортирует все переводы → −9 HTTP-запросов.
 */
function inlineLocales() {
  const VIRTUAL_ID = 'virtual:locale-data';
  const resolvedVirtualId = '\0' + VIRTUAL_ID;

  /** Папка с локалями */
  const localesDir = join(root, 'public', 'locales');

  /** Флаг: build или dev */
  let isBuild = false;

  return {
    name: 'inline-locales',

    /** Определяем режим (build vs serve) */
    config(_, { command }) {
      isBuild = command === 'build';
    },

    /** Резолвим виртуальный ID (всегда, чтобы locale-data.js не падал) */
    resolveId(id) {
      if (id === VIRTUAL_ID) return resolvedVirtualId;
    },

    /** Генерируем модуль со всеми переводами (только в build) */
    load(id) {
      if (id !== resolvedVirtualId) return;

      /** Dev-режим: оставляем fetch() для live-reload JSON */
      if (!isBuild) {
        return 'export default null;';
      }

      /** Build: собираем все JSON-файлы локалей */
      const data = {};
      for (const file of readdirSync(localesDir)) {
        if (!file.endsWith('.json')) continue;
        const lang = file.replace('.json', '');
        const json = readFileSync(join(localesDir, file), 'utf-8');
        data[lang] = JSON.parse(json);
      }

      const size = JSON.stringify(data).length;
      console.log(`[inline-locales] inlined ${Object.keys(data).length} locales (${(size / 1024).toFixed(1)} KB) → −9 HTTP-запросов`);

      return `export default ${JSON.stringify(data)};`;
    },

    /** После сборки: удаляем dist/locales/ — данные уже в бандле */
    closeBundle() {
      const distLocales = join(root, 'dist', 'locales');
      if (existsSync(distLocales)) {
        rmSync(distLocales, { recursive: true });
        console.log('[inline-locales] removed dist/locales/ (data inlined in JS bundle)');
      }
    },
  };
}

export default defineConfig({
  /** './' — относительный base: работает и на GH Pages (/wardogs-calc/), и в vite preview (/) */
  base: './',

  /** Папка с публичными статическими ресурсами (копируются в dist как есть) */
  publicDir: 'public',

  build: {
    outDir: 'dist',          /** Выходная папка сборки */
    assetsDir: 'assets-built', /** Подпапка для JS/CSS бандлов (не путать с assets/) */
    sourcemap: false,        /** Отключаем source maps для продакшена */
    emptyOutDir: true,       /** Очищаем dist перед сборкой */
  },

  server: {
    port: 5173,  /** Порт dev-сервера */
  },

  preview: {
    port: 4173,  /** Порт preview-сервера (после build) */
  },

  /** Подключаем кастомные плагины */
  plugins: [mapsPlugin(), inlineLocales()],
});
