// js/map/viewport.js — Управление камерой (view, resize, reset)

window.MapViewport = (function() {
    const view = { scale: 0.05, ox: 0, oy: 0 };
    let canvas = null, renderMap = null, saveState = null;
    let mapSize = 16000, saveTimer = null;
    function init(opts) {
        canvas = opts.canvas;
        renderMap = opts.renderMap;
        saveState = opts.saveState;
        mapSize = opts.mapSize;
        window.addEventListener('resize', resize);
    }
    function get() { return view; }
    function resize() {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = canvas.clientWidth * dpr;
        canvas.height = canvas.clientHeight * dpr;
        canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
        renderMap();
    }
    function resetView() {
        const w = canvas.clientWidth, h = canvas.clientHeight;
        view.scale = Math.min(w, h) / mapSize * 0.9;
        view.ox = w / 2 - (mapSize / 2) * view.scale;
        view.oy = h / 2 + (mapSize / 2) * view.scale;
        renderMap();
        debouncedSave();
    }
    function debouncedSave() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => { if (saveState) saveState(); }, 200);
    }
    function restore(v) {
        if (v) { view.scale = v.scale; view.ox = v.ox; view.oy = v.oy; }
    }
    function setMapSize(size) {
        mapSize = size;
    }
    return { init, get, resize, resetView, debouncedSave, restore, setMapSize };
})();