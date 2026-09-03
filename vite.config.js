import { defineConfig } from 'vite';
import { cpSync, createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const mapsSrc = join(root, 'maps');

const MIME = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.json': 'application/json',
};

function mapsPlugin() {
  return {
    name: 'wardogs-maps',

    configureServer(server) {
      server.middlewares.use('/maps', (req, res, next) => {
        try {
          const rel = decodeURIComponent((req.url || '/').split('?')[0]).replace(/^\/+/, '');
          const filePath = join(mapsSrc, rel);

          if (!filePath.startsWith(mapsSrc) || !existsSync(filePath) || statSync(filePath).isDirectory()) {
            res.statusCode = 404;
            res.end('Not found');
            return;
          }

          res.setHeader('Content-Type', MIME[extname(filePath)] || 'application/octet-stream');
          res.setHeader('Cache-Control', 'no-store');

          createReadStream(filePath).pipe(res);
        } catch (e) {
          next(e);
        }
      });
    },

    closeBundle() {
      const distMaps = join(root, 'dist', 'maps');
      mkdirSync(join(root, 'dist'), { recursive: true });
      console.log('[wardogs-maps] copying maps/ → dist/maps …');
      cpSync(mapsSrc, distMaps, { recursive: true });
      console.log('[wardogs-maps] done');
    },
  };
}

function inlineLocales() {
  const VIRTUAL_ID = 'virtual:locale-data';
  const resolvedVirtualId = '\0' + VIRTUAL_ID;
  const localesDir = join(root, 'public', 'locales');
  let isBuild = false;

  return {
    name: 'inline-locales',

    config(_, { command }) {
      isBuild = command === 'build';
    },

    resolveId(id) {
      if (id === VIRTUAL_ID) return resolvedVirtualId;
    },

    load(id) {
      if (id !== resolvedVirtualId) return;

      if (!isBuild) {
        return 'export default null;';
      }

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
  base: './',
  publicDir: 'public',
  define: {
    __BUILD_TIME__: Date.now(),
  },

  build: {
    outDir: 'dist',
    assetsDir: 'assets-built',
    sourcemap: false,
    emptyOutDir: true,
  },

  server: {
    port: 5173,
  },

  preview: {
    port: 4173,
  },

  plugins: [mapsPlugin(), inlineLocales()],
});
