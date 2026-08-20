// js/features/draw.js — Инструменты рисования (pen, line, marker) + ластик-удаление
window.AppDraw = (function (utils) {
  const TOOLS = ['pen', 'line', 'marker', 'eraser', 'pan'];
  let currentTool = 'pan';
  let currentStroke = null;
  let isDrawing = false;
  let localDrawings = [];
  let currentWidth = 1;   // толщина линии в экранных px (тонкая по умолчанию)
  let mapSize = 16000;

  function configure(size) { mapSize = size; }

  function setTool(tool) {
    if (!TOOLS.includes(tool)) return;
    currentTool = tool;
    document.querySelectorAll('.draw-tool').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === tool);
    });
  }

  function setWidth(w) {
    currentWidth = Math.max(1, Math.min(6, Number(w) || 1));
    document.querySelectorAll('.width-opt').forEach(btn => {
      btn.classList.toggle('active', Number(btn.dataset.width) === currentWidth);
    });
  }

  function getTool() { return currentTool; }
  function getWidth() { return currentWidth; }
  function getLocalDrawings() { return localDrawings; }
  function getCurrentStroke() { return currentStroke; }
  function isActive() { return isDrawing; }

  function getMyColor() {
    if (window.AppLobby && window.AppLobby.isConnected()) {
      return window.AppLobby.getMyColor() || '#9fd356';
    }
    return '#9fd356';
  }

  // ─── Начало stroke ───
  function startStroke(px, py) {
    if (currentTool === 'pan' || currentTool === 'eraser') return;
    isDrawing = true;

    if (currentTool === 'marker') {
      const label = prompt(window.STR?.markerPrompt || 'Название метки:', 'Метка');
      if (label === null) { isDrawing = false; return; }
      currentStroke = {
        tool: 'marker',
        color: getMyColor(),
        points: [{ x: px, y: py }],
        width: currentWidth,
        label: label || 'Метка'
      };
      finishStroke();
      return;
    }

    currentStroke = {
      tool: currentTool,
      color: getMyColor(),
      points: [{ x: px, y: py }],
      width: currentWidth
    };
  }

  // ─── Продолжение ───
  function continueStroke(px, py) {
    if (!isDrawing || !currentStroke) return;

    if (currentTool === 'pen') {
      const last = currentStroke.points[currentStroke.points.length - 1];
      if (Math.hypot(last.x - px, last.y - py) < 0.05) return;
      currentStroke.points.push({ x: px, y: py });
    } else if (currentTool === 'line') {
      if (currentStroke.points.length === 1) currentStroke.points.push({ x: px, y: py });
      else currentStroke.points[1] = { x: px, y: py };
    }
  }

  // ─── Завершение ───
  function finishStroke() {
    if (!isDrawing || !currentStroke) { isDrawing = false; return; }
    isDrawing = false;

    const minPoints = currentStroke.tool === 'marker' ? 1 : 2;
    if (currentStroke.points.length < minPoints) { currentStroke = null; return; }

    if (window.AppLobby && window.AppLobby.isConnected()) {
      window.AppLobby.sendDrawing(
        currentStroke.tool, currentStroke.color, currentStroke.points,
        currentStroke.width, currentStroke.label
      );
    } else {
      localDrawings.push({
        ...currentStroke,
        id: crypto.randomUUID(),
        playerId: 'local',
        createdAt: Date.now()
      });
      if (localDrawings.length > 300) localDrawings.shift();
    }
    currentStroke = null;
  }

  function cancelStroke() { isDrawing = false; currentStroke = null; }

  // ─── Ластик: удаляет ТОЛЬКО свои штрихи (линии, линейки, метки) ───
  function eraseAt(sx, sy, view) {
    const connected = window.AppLobby && window.AppLobby.isConnected();
    const strokes = connected ? window.AppLobby.getDrawings() : localDrawings;
    const myId = connected ? window.AppLobby.getMyId() : 'local';
    const R = 12; // радиус захвата в px
    let removed = false;

    for (let i = strokes.length - 1; i >= 0; i--) {
      const st = strokes[i];
      if (st.playerId !== myId) continue; // стираем только своё

      let hit = false;
      for (const p of st.points || []) {
        const s = utils.worldToScreen(
          utils.percentToMeters(p.x, mapSize),
          utils.percentToMeters(p.y, mapSize),
          view
        );
        if (Math.hypot(s.x - sx, s.y - sy) <= R) { hit = true; break; }
      }

      if (hit) {
        const [del] = strokes.splice(i, 1);
        if (connected && del.id) window.AppLobby.deleteDrawing(del.id);
        removed = true;
      }
    }
    return removed;
  }

  function clearDrawings() {
    if (window.AppLobby && window.AppLobby.isConnected()) {
      if (window.AppLobby.isHost()) window.AppLobby.clearDrawings();
    } else {
      localDrawings = [];
    }
  }

  return {
    configure, setTool, setWidth, getTool, getWidth,
    getLocalDrawings, getCurrentStroke, isActive,
    startStroke, continueStroke, finishStroke, cancelStroke,
    eraseAt, clearDrawings
  };
})(window.AppUtils);