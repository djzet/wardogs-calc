import { defineConfig } from 'vite';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, createReadStream } from 'node:fs';
import { cp } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const mapsSrc = 'E:\\wardogs-maps\\maps';

const MIME = {
  '.webp': 'image/webp',
  '.pmtiles': 'application/vnd.pmtiles',
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
        if (!existsSync(mapsSrc)) {
          console.log('[mapsPlugin] maps/ not found locally, proxying to remote');
          res.statusCode = 302;
          const remoteUrl = `https://djzet.github.io/wardogs-maps${req.url}`;
          res.setHeader('Location', remoteUrl);
          return res.end();
        }
        try {
          const rel = decodeURIComponent((req.url || '/').split('?')[0]).replace(/^\/+/, '');
          const filePath = join(mapsSrc, rel);

          if (!filePath.startsWith(mapsSrc)) {
            res.statusCode = 403;
            return res.end('Forbidden');
          }

          const stat = statSync(filePath, { throwIfNoEntry: false });
          if (!stat || stat.isDirectory()) {
            res.statusCode = 404;
            return res.end('Not found');
          }

          res.setHeader('Content-Type', MIME[extname(filePath)] || 'application/octet-stream');
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

          createReadStream(filePath).pipe(res);
        } catch (e) {
          next(e);
        }
      });
    },

    async closeBundle() {
      if (!existsSync(mapsSrc)) {
        console.log('[wardogs-maps] maps/ not found — using remote tiles, skipping copy');
        return;
      }
      const distMaps = join(root, 'dist', 'maps');
      mkdirSync(join(root, 'dist'), { recursive: true });
      cpSync(mapsSrc, distMaps, { recursive: true });
      console.log('[wardogs-maps] copied maps/ → dist/maps/');
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
    watch: {
      ignored: ['**/maps*', '**/maps/**']
    }
  },

  preview: {
    port: 4173,
  },

  plugins: [mapsPlugin(), inlineLocales()],
});
