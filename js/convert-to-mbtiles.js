import Database from 'better-sqlite3';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

const maps = ['bakurani', 'ozeti'];

async function createMBTiles() {
  for (const map of maps) {
    const tilesDir = join('maps', map, 'tiles');
    const dbPath = join('maps', `${map}.mbtiles`);
    
    try {
      const db = new Database(dbPath);

      // Стандартная схема MBTiles
      db.exec(`CREATE TABLE metadata (name TEXT, value TEXT);`);
      db.exec(`CREATE TABLE tiles (zoom_level INTEGER, tile_column INTEGER, tile_row INTEGER, tile_data BLOB, PRIMARY KEY (zoom_level, tile_column, tile_row));`);
      
      const insertTile = db.prepare(`INSERT INTO tiles (zoom_level, tile_column, tile_row, tile_data) VALUES (?, ?, ?, ?)`);
      const insertMeta = db.prepare(`INSERT INTO metadata (name, value) VALUES (?, ?)`);

      insertMeta.run('name', map);
      insertMeta.run('format', 'webp');
      insertMeta.run('type', 'baselayer');

      let tileCount = 0;
      let minZoom = 99;
      let maxZoom = 0;

      const zooms = await readdir(tilesDir);
      
      for (const zoomDir of zooms) {
        const z = parseInt(zoomDir.replace('zoom_', ''));
        minZoom = Math.min(minZoom, z);
        maxZoom = Math.max(maxZoom, z);
        
        const zoomPath = join(tilesDir, zoomDir);
        const files = await readdir(zoomPath);
        
        for (const file of files) {
          if (!file.endsWith('.webp')) continue;
          
          const [x, y] = file.replace('.webp', '').split('_').map(Number);
          
          // MBTiles использует схему TMS (координата Y перевернута)
          const tms_y = Math.pow(2, z) - 1 - y;
          
          const data = await readFile(join(zoomPath, file));
          insertTile.run(z, x, tms_y, data);
          tileCount++;
        }
      }
      
      insertMeta.run('minzoom', minZoom.toString());
      insertMeta.run('maxzoom', maxZoom.toString());
      insertMeta.run('bounds', '0,0,163.83,163.83');
      insertMeta.run('center', '81.9,74.5,4');
      
      db.close();
      console.log(`✅ Создан ${dbPath} (${tileCount} тайлов)`);
    } catch (err) {
      console.error(`❌ Ошибка при создании ${map}.mbtiles:`, err.message);
    }
  }
}

createMBTiles();