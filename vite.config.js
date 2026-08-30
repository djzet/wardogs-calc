import { defineConfig } from 'vite';
import { cpSync, createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
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

/** Раздача maps/ в dev + копирование в dist при build */
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
          res.setHeader('Cache-Control', 'public, max-age=86400');
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

export default defineConfig({
  // Относительный base: работает и на GH Pages (/wardogs-calc/), и в vite preview (/)
  base: './',
  publicDir: 'public',
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
  plugins: [mapsPlugin()],
});
