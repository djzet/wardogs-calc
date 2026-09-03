window.AppDraw = (function (utils) {
  const TOOLS = ['pen', 'line', 'marker', 'eraser', 'pan'];
  let currentTool = 'pan';
  let currentStroke = null;
  let isDrawing = false;
  let localDrawings = [];
  let currentWidth = 1;
  let mapSize = 160;
  let STR = null;
  let _toolBtns, _widthBtns;
  let pendingMarker = null;
  let _cleanupModal = null;
  let onStrokeComplete = null;

  function configure(size, str) {
    mapSize = size;
    if (str) STR = str;
  }

  function initButtons() {
    _toolBtns = document.querySelectorAll('.draw-tool');
    _widthBtns = document.querySelectorAll('.width-opt');
  }

  function setOnStrokeComplete(fn) { onStrokeComplete = fn; }
  function setTool(tool) {
    if (!TOOLS.includes(tool)) return;
    currentTool = tool;
    _toolBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === tool);
    });
  }

  function setWidth(w) {
    currentWidth = Math.max(1, Math.min(6, Number(w) || 1));
    _widthBtns.forEach(btn => {
      btn.classList.toggle('active', Number(btn.dataset.width) === currentWidth);
    });
  }

  function getTool() { return currentTool; }
  function getWidth() { return currentWidth; }
  function getLocalDrawings() { return localDrawings; }
  function getCurrentStroke() { return currentStroke; }
  function isActive() { return isDrawing; }
  function startStroke(px, py) {
    if (currentTool === 'pan' || currentTool === 'eraser') return;
    px = Math.max(0, Math.min(100, px));
    py = Math.max(0, Math.min(100, py));
    if (currentTool === 'marker') {
      showMarkerModal(px, py);
      return;
    }
    isDrawing = true;
    currentStroke = {
      tool: currentTool,
      color: '#9fd356',
      points: [{ x: px, y: py }],
      width: currentWidth
    };
  }

  function continueStroke(px, py) {
    if (!isDrawing || !currentStroke) return;
    px = Math.max(0, Math.min(100, px));
    py = Math.max(0, Math.min(100, py));
    if (currentTool === 'pen') {
      const last = currentStroke.points[currentStroke.points.length - 1];
      if (Math.hypot(last.x - px, last.y - py) < 0.05) return;
      currentStroke.points.push({ x: px, y: py });
    } else if (currentTool === 'line') {
      if (currentStroke.points.length === 1) currentStroke.points.push({ x: px, y: py });
      else currentStroke.points[1] = { x: px, y: py };
    }
  }

  function finishStroke() {
    if (!isDrawing || !currentStroke) { isDrawing = false; return; }
    isDrawing = false;
    const minPoints = currentStroke.tool === 'marker' ? 1 : 2;
    if (currentStroke.points.length < minPoints) { currentStroke = null; return; }
    localDrawings.push({
      ...currentStroke,
      id: (crypto.randomUUID && crypto.randomUUID()) ||
        ('id_' + Date.now().toString(36) + Math.random().toString(36).slice(2)),
      playerId: 'local',
      createdAt: Date.now()
    });
    const MAX_LOCAL_DRAWINGS = 500;
    if (localDrawings.length > MAX_LOCAL_DRAWINGS) localDrawings.shift();
    currentStroke = null;
    if (onStrokeComplete) onStrokeComplete();
  }

  function cancelStroke() { isDrawing = false; currentStroke = null; }
  function hideMarkerModal() {
    if (_cleanupModal) { _cleanupModal(); _cleanupModal = null; }
    const modal = document.getElementById('markerModal');
    if (modal) modal.classList.add('hidden');
    pendingMarker = null;
    cancelStroke();
  }

  function eraseAt(sx, sy, view) {
    const baseEraseRadius = 8;
    let removed = false;
    for (let i = localDrawings.length - 1; i >= 0; i--) {
      const st = localDrawings[i];
      const strokeRadius = baseEraseRadius + 2 * (st.width || 1);
      let hit = false;
      for (const p of st.points || []) {
        const s = utils.worldToScreen(
          utils.percentToWorld(p.x, mapSize),
          utils.percentToWorld(p.y, mapSize),
          view
        );
        if (Math.hypot(s.x - sx, s.y - sy) <= strokeRadius) {
          hit = true;
          break;
        }
      }
      if (hit) {
        localDrawings.splice(i, 1);
        removed = true;
      }
    }
    return removed;
  }

  function clearDrawings() {
    localDrawings = [];
    cancelStroke();
  }

  function showMarkerModal(px, py) {
    const modal = document.getElementById('markerModal');
    const input = document.getElementById('markerInput');
    const okBtn = document.getElementById('markerOk');
    const cancelBtn = document.getElementById('markerCancel');
    if (!modal || !input) return;
    pendingMarker = { px, py };
    modal.classList.remove('hidden');
    input.value = '';
    requestAnimationFrame(() => {
      input.focus();
      input.select();
    });
    function onOk() {
      const label = input.value.trim() || (STR ? (STR.markerDefault || 'Метка') : 'Метка');
      cleanup();
      isDrawing = true;
      currentStroke = {
        tool: 'marker',
        color: '#9fd356',
        points: [{ x: pendingMarker.px, y: pendingMarker.py }],
        width: currentWidth,
        label
      };
      finishStroke();
      pendingMarker = null;
    }

    function onCancel() {
      cleanup();
      pendingMarker = null;
    }

    function onKey(e) {
      if (e.key === 'Enter') { e.preventDefault(); onOk(); }
      else if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
    }

    function cleanup() {
      _cleanupModal = null;
      modal.classList.add('hidden');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      input.removeEventListener('keydown', onKey);
      modal.removeEventListener('mousedown', onBackdrop);
    }

    function onBackdrop(e) {
      if (e.target === modal) onCancel();
    }

    _cleanupModal = cleanup;
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    input.addEventListener('keydown', onKey);
    modal.addEventListener('mousedown', onBackdrop);
  }
  
  return {
    configure, initButtons, setOnStrokeComplete,
    setTool, setWidth, getTool, getWidth,
    getLocalDrawings, getCurrentStroke, isActive,
    startStroke, continueStroke, finishStroke, cancelStroke,
    eraseAt, clearDrawings, showMarkerModal, hideMarkerModal
  };
})(window.AppUtils);