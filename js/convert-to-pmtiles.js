import { write } from 'pmtiles';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

const maps = ['bakurani', 'ozeti'];

async function convert() {
  for (const map of maps) {
    const tilesDir = join('maps', map, 'tiles');
    const tiles = new Map();
    let minZoom = 999, maxZoom = -1;
    
    const zooms = await readdir(tilesDir);
    
    for (const zoomDir of zooms) {
      const z = parseInt(zoomDir.replace('zoom_', ''));
      const zoomPath = join(tilesDir, zoomDir);
      const files = await readdir(zoomPath);
      
      minZoom = Math.min(minZoom, z);
      maxZoom = Math.max(maxZoom, z);
      
      for (const file of files) {
        if (!file.endsWith('.webp')) continue;
        
        const [x, y] = file.replace('.webp', '').split('_').map(Number);
        const data = await readFile(join(zoomPath, file));
        tiles.set(`${z}/${x}/${y}`, data);
      }
    }
    
    const output = `maps/${map}.pmtiles`;
    
    await write(output, {
      tiles,
      minZoom,
      maxZoom,
      tileType: 'webp',
      metadata: { name: map, format: 'webp' }
    });
    
    console.log(`✅ Created ${output} (${tiles.size} tiles)`);
  }
}

convert();