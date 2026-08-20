// js/map/interactions.js — Обработка пользовательских взаимодействий
window.MapInteractions = (function () {
    const MIN_SCALE = 0.005;
    const MAX_SCALE = 4;

    let pointers = new Map();
    let pinch = null;
    let longPressTimer = null;
    let longPressFired = false;
    let lastTouchTs = 0;
    let dragging = null;

    function canvasPos(e, canvas) {
        const r = canvas.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    function stopLongPress() { clearTimeout(longPressTimer); }

    function startLongPress(sx, sy, delay, callback) {
        clearTimeout(longPressTimer);
        longPressFired = false;
        longPressTimer = setTimeout(() => {
            longPressFired = true;
            dragging = null;
            callback(sx, sy);
        }, delay);
    }

    function handlePointerDown(e, canvas, opts) {
        const { view, hitPoint, findTowerAt, openMenuAt, hideMenu, LONG_PRESS_MS, utils, mapSize, renderMap } = opts;
        const p = canvasPos(e, canvas);

        if (e.pointerType !== 'mouse') lastTouchTs = performance.now();

        try { canvas.setPointerCapture(e.pointerId); } catch (_) { }
        pointers.set(e.pointerId, p);

        // ─── Средняя кнопка мыши — ВСЕГДА перемещение карты,
        // независимо от выбранного инструмента (карандаш, метка, ластик...) ───
        if (e.button === 1) {
            e.preventDefault(); // блокируем autoscroll
            stopLongPress();
            dragging = { mode: 'pan', startX: p.x, startY: p.y, ox: view.ox, oy: view.oy };
            canvas.style.cursor = 'grabbing';
            return;
        }

        if (e.button !== 0) return;
        if (typeof hideMenu === 'function') hideMenu();

        if (pointers.size === 2) {
            stopLongPress();
            dragging = null;
            const [p1, p2] = [...pointers.values()];
            const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
            pinch = {
                dist: Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1,
                scale: view.scale,
                anchor: utils.screenToWorld(mid.x, mid.y, view),
            };
            return;
        }
        if (pointers.size > 2) return;

        if (e.pointerType !== 'mouse') {
            startLongPress(p.x, p.y, LONG_PRESS_MS, (sx, sy) => {
                openMenuAt(sx, sy);
            });
        }

        const hit = hitPoint(p.x, p.y);
        if (hit) {
            dragging = { mode: 'point', key: hit };
            canvas.style.cursor = 'grabbing';
            return;
        }

        const towerHit = findTowerAt(p.x, p.y);
        if (towerHit) {
            dragging = { mode: 'tower-or-pan', tower: towerHit, startX: p.x, startY: p.y, ox: view.ox, oy: view.oy };
            return;
        }

        // ─── Ластик: удаляет свои штрихи ───
        const drawTool = window.AppDraw ? window.AppDraw.getTool() : 'pan';
        if (drawTool === 'eraser') {
            stopLongPress();
            dragging = { mode: 'erase' };
            if (window.AppDraw.eraseAt(p.x, p.y, view) && renderMap) renderMap();
            canvas.style.cursor = 'cell';
            return;
        }

        // ─── Рисование ───
        if (drawTool !== 'pan') {
            stopLongPress();
            const wpt = utils.screenToWorld(p.x, p.y, view);
            const px = utils.metersToPercent(wpt.x, mapSize);
            const py = utils.metersToPercent(wpt.y, mapSize);
            window.AppDraw.startStroke(px, py);
            dragging = { mode: 'draw' };
            if (renderMap) renderMap();
            canvas.style.cursor = 'crosshair';
            return;
        }

        dragging = { mode: 'pan', startX: p.x, startY: p.y, ox: view.ox, oy: view.oy };
        canvas.style.cursor = 'grabbing';
    }

    function handlePointerMove(e, canvas, opts) {
        const { view, renderMap, debouncedSaveView, hitPoint, findTowerAt, setPoint, utils, TAP_THRESHOLD, mapSize } = opts;
        const p = canvasPos(e, canvas);
        const tracked = pointers.has(e.pointerId);

        if (tracked) {
            pointers.set(e.pointerId, p);
            if (e.pointerType !== 'mouse') lastTouchTs = performance.now();
        }

        if (pinch && pointers.size >= 2) {
            const [p1, p2] = [...pointers.values()];
            const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
            const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1;
            const newScale = utils.clamp(pinch.scale * dist / pinch.dist, MIN_SCALE, MAX_SCALE);
            view.scale = newScale;
            view.ox = mid.x - pinch.anchor.x * newScale;
            view.oy = mid.y + pinch.anchor.y * newScale;
            renderMap();
            debouncedSaveView();
            return;
        }

        const cursorCoords = document.getElementById('cursorCoords');
        if (cursorCoords) {
            const wpt = utils.screenToWorld(p.x, p.y, view);

            // Безопасно через DOM API (без innerHTML)
            cursorCoords.textContent = '';
            const xSpan = document.createElement('span');
            xSpan.textContent = `x${utils.gameCoord(wpt.x)}`;
            const ySpan = document.createElement('span');
            ySpan.textContent = `y${utils.gameCoord(wpt.y)}`;
            cursorCoords.appendChild(xSpan);
            cursorCoords.appendChild(ySpan);

            // Позиция справа-снизу от мыши, с переворотом у краёв
            const wrap = canvas.parentElement.getBoundingClientRect();
            let lx = p.x + 14;
            let ly = p.y + 18;
            if (lx + 80 > wrap.width) lx = p.x - 90;
            if (ly + 44 > wrap.height) ly = p.y - 50;
            cursorCoords.style.left = lx + 'px';
            cursorCoords.style.top = ly + 'px';
            cursorCoords.classList.add('visible');
        }

        // ─── Ластик в процессе ───
        if (dragging && dragging.mode === 'erase') {
            stopLongPress();
            if (window.AppDraw.eraseAt(p.x, p.y, view)) renderMap();
            return;
        }

        // ─── Рисование в процессе ───
        if (dragging && dragging.mode === 'draw') {
            stopLongPress();
            const wpt = utils.screenToWorld(p.x, p.y, view);
            const px = utils.metersToPercent(wpt.x, mapSize);
            const py = utils.metersToPercent(wpt.y, mapSize);
            window.AppDraw.continueStroke(px, py);
            renderMap();
            return;
        }

        if (!tracked) {
            if (e.pointerType === 'mouse' && !dragging) {
                const overPoint = hitPoint(p.x, p.y);
                const overTower = !overPoint && findTowerAt(p.x, p.y);
                canvas.style.cursor = overPoint ? 'grab' : (overTower ? 'pointer' : 'crosshair');
            }
            return;
        }

        if (!dragging) return;

        if (dragging.mode === 'tower-or-pan') {
            const moved = Math.hypot(p.x - dragging.startX, p.y - dragging.startY) > TAP_THRESHOLD;
            if (!moved) return;
            stopLongPress();
            dragging = { mode: 'pan', startX: dragging.startX, startY: dragging.startY, ox: dragging.ox, oy: dragging.oy };
            canvas.style.cursor = 'grabbing';
        }

        if (dragging.mode === 'pan') {
            stopLongPress();
            view.ox = dragging.ox + (p.x - dragging.startX);
            view.oy = dragging.oy + (p.y - dragging.startY);
            renderMap();
            debouncedSaveView();
        } else if (dragging.mode === 'point') {
            stopLongPress();
            const wpt = utils.screenToWorld(p.x, p.y, view);
            const px = utils.clamp(Math.round(utils.metersToPercent(wpt.x, mapSize) * 100) / 100, 0, 100);
            const py = utils.clamp(Math.round(utils.metersToPercent(wpt.y, mapSize) * 100) / 100, 0, 100);
            setPoint(dragging.key, utils.percentToMeters(px, mapSize), utils.percentToMeters(py, mapSize));
        }
    }

    function handlePointerUp(e, canvas, opts) {
        const { view, renderMap, findTowerAt, selectedTower, setSelectedTower } = opts;

        if (!pointers.has(e.pointerId)) return;
        pointers.delete(e.pointerId);
        try { canvas.releasePointerCapture(e.pointerId); } catch (_) { }

        stopLongPress();

        if (pinch) {
            if (pointers.size >= 2) return;
            pinch = null;
            if (pointers.size === 1) {
                const [rest] = [...pointers.values()];
                dragging = { mode: 'pan', startX: rest.x, startY: rest.y, ox: view.ox, oy: view.oy };
            } else {
                dragging = null;
            }
            return;
        }

        // ─── Конец ластика ───
        if (dragging && dragging.mode === 'erase') {
            dragging = null;
            canvas.style.cursor = 'cell';
            return;
        }

        // ─── Конец рисования ───
        if (dragging && dragging.mode === 'draw') {
            window.AppDraw.finishStroke();
            dragging = null;
            renderMap();
            const tool = window.AppDraw ? window.AppDraw.getTool() : 'pan';
            canvas.style.cursor = tool === 'eraser' ? 'cell' : 'crosshair';
            return;
        }

        if (dragging && dragging.mode === 'tower-or-pan' && !longPressFired && e.button === 0) {
            const p = canvasPos(e, canvas);
            if (findTowerAt(p.x, p.y) === dragging.tower) {
                setSelectedTower((selectedTower === dragging.tower) ? null : dragging.tower);
                renderMap();
            }
        }
        longPressFired = false;

        if (pointers.size === 0) {
            dragging = null;
            const tool = window.AppDraw ? window.AppDraw.getTool() : 'pan';
            canvas.style.cursor = tool === 'eraser' ? 'cell' : 'crosshair';
        }
    }

    function handleBlur(canvas) {
        pointers.clear();
        pinch = null;
        dragging = null;
        stopLongPress();
        longPressFired = false;
        canvas.style.cursor = 'crosshair';
        if (window.AppDraw) window.AppDraw.cancelStroke();
    }

    function handleWheel(e, canvas, opts) {
        const { view, renderMap, debouncedSaveView, utils } = opts;
        e.preventDefault();
        const factor = Math.exp(-e.deltaY * 0.0015);
        const newScale = utils.clamp(view.scale * factor, MIN_SCALE, MAX_SCALE);
        const wpt = utils.screenToWorld(e.offsetX, e.offsetY, view);
        view.scale = newScale;
        view.ox = e.offsetX - wpt.x * view.scale;
        view.oy = e.offsetY + wpt.y * view.scale;
        renderMap();
        debouncedSaveView();
    }

    function handleContextMenu(e, canvas, opts) {
        const { openMenuAt } = opts;
        e.preventDefault();
        const fromTouch = performance.now() - lastTouchTs < 1000;
        if (fromTouch && longPressFired) return;
        stopLongPress();
        const p = canvasPos(e, canvas);
        openMenuAt(p.x, p.y);
    }

    return {
        handlePointerDown, handlePointerMove, handlePointerUp,
        handleBlur, handleWheel, handleContextMenu
    };
})();