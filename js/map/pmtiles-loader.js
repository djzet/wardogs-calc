// PMTiles загрузчик
window.PMTilesLoader = (function() {
  const sources = {};
  const initialized = new Set();
  
  async function init(mapId, pmtilesUrl) {
    if (initialized.has(mapId)) return;
    
    if (!window.PMTiles) {
      console.error('[PMTiles] Library not loaded');
      return;
    }
    
    try {
      const source = new window.PMTiles(pmtilesUrl);
      sources[mapId] = source;
      
      // Проверяем доступность
      const metadata = await source.getMetadata();
      console.log(`[PMTiles] ✅ ${mapId} initialized:`, metadata);
      
      initialized.add(mapId);
    } catch (err) {
      console.error(`[PMTiles] ❌ Failed to init ${mapId}:`, err);
    }
  }
  
  async function getTileBlob(mapId, z, x, y) {
    const source = sources[mapId];
    if (!source) {
      throw new Error(`PMTiles source ${mapId} not initialized`);
    }
    
    const response = await source.getZxy(z, x, y);
    if (!response) return null;
    
    return new Blob([response.data], { type: 'image/webp' });
  }
  
  async function getTileUrl(mapId, z, x, y) {
    try {
      const blob = await getTileBlob(mapId, z, x, y);
      if (!blob) return null;
      return URL.createObjectURL(blob);
    } catch (err) {
      console.error(`[PMTiles] Error loading tile ${mapId}/${z}/${x}/${y}:`, err);
      return null;
    }
  }
  
  function isInitialized(mapId) {
    return initialized.has(mapId);
  }
  
  return { init, getTileBlob, getTileUrl, isInitialized };
})();