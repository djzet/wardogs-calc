// js/features/draw.js — Инструменты рисования (pen, line, marker, eraser)

window.AppDraw = (function(utils) {
  const TOOLS = ['pen', 'line', 'marker', 'eraser', 'pan'];
  let currentTool = 'pan';
  let currentStroke = null;
  let isDrawing = false;
  let localDrawings = [];

  const WIDTH_PEN = 2;
  const WIDTH_ERASER = 10;

  function setTool(tool) {
    if (!TOOLS.includes(tool)) return;
    currentTool = tool;
    document.querySelectorAll('.draw-tool').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === tool);
    });
  }

  function getTool() { return currentTool; }
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
    if (currentTool === 'pan') return;
    isDrawing = true;

    if (currentTool === 'marker') {
      const label = prompt(window.STR?.markerPrompt || 'Название метки:', 'Метка');
      if (label === null) { isDrawing = false; return; }
      currentStroke = {
        tool: 'marker',
        color: getMyColor(),
        points: [{ x: px, y: py }],
        width: 3,
        label: label || 'Метка'
      };
      finishStroke();
      return;
    }

    currentStroke = {
      tool: currentTool,
      color: currentTool === 'eraser' ? null : getMyColor(),
      points: [{ x: px, y: py }],
      width: currentTool === 'eraser' ? WIDTH_ERASER : WIDTH_PEN
    };
  }

  // ─── Продолжение ───
  function continueStroke(px, py) {
    if (!isDrawing || !currentStroke) return;

    if (currentTool === 'pen' || currentTool === 'eraser') {
      // Добавляем точку только если отдалена на 0.05% (оптимизация)
      const last = currentStroke.points[currentStroke.points.length - 1];
      if (Math.hypot(last.x - px, last.y - py) < 0.05) return;
      currentStroke.points.push({ x: px, y: py });
    } else if (currentTool === 'line') {
      if (currentStroke.points.length === 1) {
        currentStroke.points.push({ x: px, y: py });
      } else {
        currentStroke.points[1] = { x: px, y: py };
      }
    }
  }

  // ─── Завершение ───
  function finishStroke() {
    if (!isDrawing || !currentStroke) { isDrawing = false; return; }
    isDrawing = false;

    const minPoints = currentStroke.tool === 'marker' ? 1 : 2;
    if (currentStroke.points.length < minPoints) {
      currentStroke = null;
      return;
    }

    // Отправляем в лобби или сохраняем локально
    if (window.AppLobby && window.AppLobby.isConnected()) {
      window.AppLobby.sendDrawing(
        currentStroke.tool,
        currentStroke.color,
        currentStroke.points,
        currentStroke.width,
        currentStroke.label
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

  function cancelStroke() {
    isDrawing = false;
    currentStroke = null;
  }

  function clearDrawings() {
    if (window.AppLobby && window.AppLobby.isConnected()) {
      if (window.AppLobby.isHost()) window.AppLobby.clearDrawings();
    } else {
      localDrawings = [];
    }
  }

  return {
    setTool, getTool,
    getLocalDrawings, getCurrentStroke,
    isActive,
    startStroke, continueStroke, finishStroke, cancelStroke,
    clearDrawings
  };
})(window.AppUtils);