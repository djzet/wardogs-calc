/**
 *
 * Поддерживает 5 инструментов:
 *   pen    — свободное рисование карандашом (много точек)
 *   line   — линейка/линия (2 точки с расстоянием)
 *   marker — метка (одна точка + текстовая подпись)
 *   eraser — ластик (удаление рисунков по клику)
 *   pan    — перемещение карты (рисование отключено)
 *
 * Координаты рисунков хранятся в процентах карты (0–100%)
 * для совместимости при смене карты и масштабировании.
 *
 * Зависимости: window.AppUtils
 * Экспорт: window.AppDraw
 */

window.AppDraw = (function (utils) {

  /** Доступные инструменты рисования */
  const TOOLS = ['pen', 'line', 'marker', 'eraser', 'pan'];

  /** Текущий активный инструмент */
  let currentTool = 'pan';

  /** Текущий рисуемый штрих (preview до завершения) */
  let currentStroke = null;

  /** Флаг: идёт ли процесс рисования (mouse/touch зажат) */
  let isDrawing = false;

  /** Массив завершённых рисунков */
  let localDrawings = [];

  /** Текущая толщина линии (1–6 px) */
  let currentWidth = 1;

  /** Размер текущей карты в метрах (для конвертации координат) */
  let mapSize = 16000;

  /** Прокси локализации (STR.key → LocaleManager.t(key)) */
  let STR = null;

  /** Координаты pending-маркера (ожидание ввода имени через модалку) */
  let pendingMarker = null;

  /** Ссылка на cleanup-функцию модалки маркера (для корректного снятия listener'ов при Escape) */
  let _cleanupModal = null;

  /** Колбэк при успешном завершении штриха (для перерисовки карты) */
  let onStrokeComplete = null;

  /**
   * Устанавливает размер карты и ссылку на локализацию.
   * Вызывается при загрузке и при смене карты.
   * @param {number} size — размер карты в метрах
   * @param {object} str — прокси локализации (STR)
   */
  function configure(size, str) {
    mapSize = size;
    if (str) STR = str;
  }

  /**
   * Устанавливает колбэк, вызываемый при сохранении штриха.
   * Используется для перерисовки карты после маркера.
   * @param {Function} fn — callback
   */
  function setOnStrokeComplete(fn) { onStrokeComplete = fn; }

  /**
   * Устанавливает активный инструмент рисования и обновляет UI-кнопки.
   * @param {'pen'|'line'|'marker'|'eraser'|'pan'} tool — имя инструмента
   */
  function setTool(tool) {
    if (!TOOLS.includes(tool)) return;
    currentTool = tool;
    /** Обновляем CSS-класс active на кнопках инструментов */
    document.querySelectorAll('.draw-tool').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === tool);
    });
  }

  /**
   * Устанавливает толщину линии для рисования и обновляет UI-кнопки.
   * @param {number} w — толщина (1–6)
   */
  function setWidth(w) {
    currentWidth = Math.max(1, Math.min(6, Number(w) || 1));
    document.querySelectorAll('.width-opt').forEach(btn => {
      btn.classList.toggle('active', Number(btn.dataset.width) === currentWidth);
    });
  }

  /** Возвращает текущий активный инструмент рисования. @returns {'pen'|'line'|'marker'|'eraser'|'pan'} */
  function getTool() { return currentTool; }

  /** Возвращает текущую толщину линии. @returns {number} */
  function getWidth() { return currentWidth; }

  /** Возвращает массив локальных рисунков. @returns {Array} */
  function getLocalDrawings() { return localDrawings; }

  /** Возвращает штрих, который рисуется прямо сейчас (preview-режим). @returns {object|null} */
  function getCurrentStroke() { return currentStroke; }

  /** Проверяет, идёт ли процесс рисования. @returns {boolean} */
  function isActive() { return isDrawing; }

  /**
   * Начинает новый штрих (линию/карандаш/метку) в процентах координат карты.
   *
   * Для маркера — запрашивает название через prompt и сразу завершает (1 точка).
   * Для pen/line — начинает накопление точек.
   *
   * @param {number} px — X координата в процентах карты (0–100)
   * @param {number} py — Y координата в процентах карты (0–100)
   */
  function startStroke(px, py) {
    if (currentTool === 'pan' || currentTool === 'eraser') return;

    /** Clamp coordinates to map bounds [0, 100] */
    px = Math.max(0, Math.min(100, px));
    py = Math.max(0, Math.min(100, py));

    /** Маркер: показываем кастомную модалку вместо prompt() */
    if (currentTool === 'marker') {
      showMarkerModal(px, py);
      return;
    }

    /** Pen или line: начинаем накопление точек */
    isDrawing = true;
    currentStroke = {
      tool: currentTool,
      color: '#9fd356',
      points: [{ x: px, y: py }],
      width: currentWidth
    };
  }

  /**
   * Продолжает текущий штрих, добавляя новую точку.
   *
   * Для pen: добавляет точку если расстояние > 0.05% (фильтр шума ввода).
   * Для line: обновляет вторую (конечную) точку (всего 2 точки).
   *
   * @param {number} px — X координата в процентах карты
   * @param {number} py — Y координата в процентах карты
   */
  function continueStroke(px, py) {
    if (!isDrawing || !currentStroke) return;

    /** Clamp coordinates to map bounds [0, 100] */
    px = Math.max(0, Math.min(100, px));
    py = Math.max(0, Math.min(100, py));

    if (currentTool === 'pen') {
      /** Фильтр шума: игнорируем движения < 0.05% от размера карты */
      const last = currentStroke.points[currentStroke.points.length - 1];
      if (Math.hypot(last.x - px, last.y - py) < 0.05) return;
      currentStroke.points.push({ x: px, y: py });
    } else if (currentTool === 'line') {
      /** Линия: первая точка задаётся при startStroke, вторая — текущая позиция */
      if (currentStroke.points.length === 1) currentStroke.points.push({ x: px, y: py });
      else currentStroke.points[1] = { x: px, y: py };
    }
  }

  /**
   * Завершает текущий штрих:
   * Сохраняет в локальный массив с UUID и timestamp
   * - Ограничивает массив до 500 элементов (старые удаляются)
   */
  function finishStroke() {
    if (!isDrawing || !currentStroke) { isDrawing = false; return; }
    isDrawing = false;

    /** Минимальное количество точек для валидного штриха */
    const minPoints = currentStroke.tool === 'marker' ? 1 : 2;
    if (currentStroke.points.length < minPoints) { currentStroke = null; return; }

    /** Сохраняем локально с уникальным ID */
    localDrawings.push({
      ...currentStroke,
      id: (crypto.randomUUID && crypto.randomUUID()) ||
        ('id_' + Date.now().toString(36) + Math.random().toString(36).slice(2)),
      playerId: 'local',
      createdAt: Date.now()
    });
    /** Ограничение: не более 500 локальных рисунков */
    const MAX_LOCAL_DRAWINGS = 500;
    if (localDrawings.length > MAX_LOCAL_DRAWINGS) localDrawings.shift();
    currentStroke = null;

    /** Уведомляем о завершении штриха (перерисовка карты) */
    if (onStrokeComplete) onStrokeComplete();
  }

  /** Отменяет текущий штрих без сохранения (например, при потере фокуса). */
  function cancelStroke() { isDrawing = false; currentStroke = null; }

  /**
   * Скрывает модалку маркера с полной очисткой состояния:
   * — снимает все обработчики событий (onOk, onCancel, onKey, onBackdrop)
   * — сбрасывает pendingMarker
   * — отменяет текущий штрих
   * Используется при закрытии модалки через Escape или программно.
   */
  function hideMarkerModal() {
    if (_cleanupModal) { _cleanupModal(); _cleanupModal = null; }
    const modal = document.getElementById('markerModal');
    if (modal) modal.classList.add('hidden');
    pendingMarker = null;
    cancelStroke();
  }

  /**
   * Удаляет рисунок в указанной экраниной позиции (лАстик).
   *
   * Алгоритм:
   * 1. Проходит по всем штрихам в обратном порядке (верхний слой первый)
   * 2. Для каждого штриха проверяет расстояние от (sx, sy) до каждой точки
   * 3. Радиус попадания = 8 + 2×толщина линии
   *
   * @param {number} sx — экраниая X координата (пиксели)
   * @param {number} sy — экраниая Y координата (пиксели)
   * @param {{scale: number, ox: number, oy: number}} view — объект камеры
   * @returns {boolean} true, если что-то было удалено
   */
  function eraseAt(sx, sy, view) {
    const baseEraseRadius = 8;
    let removed = false;

    for (let i = localDrawings.length - 1; i >= 0; i--) {
      const st = localDrawings[i];

      const strokeRadius = baseEraseRadius + 2 * (st.width || 1);
      let hit = false;

      for (const p of st.points || []) {
        const s = utils.worldToScreen(
          utils.percentToMeters(p.x, mapSize),
          utils.percentToMeters(p.y, mapSize),
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

  /** Очищает все локальные рисунки. */
  function clearDrawings() {
    localDrawings = [];
    cancelStroke();
  }

  // ═══════════════════════════════════════════════════════════
  //  Модалка имени маркера (заменяет prompt())
  // ═══════════════════════════════════════════════════════════

  /**
   * Показывает кастомную модалку для ввода имени маркера.
   * Вместо блокирующего prompt() — non-blocking модалка.
   *
   * @param {number} px — X координата маркера (проценты)
   * @param {number} py — Y координата маркера (проценты)
   */
  function showMarkerModal(px, py) {
    const modal = document.getElementById('markerModal');
    const input = document.getElementById('markerInput');
    const okBtn = document.getElementById('markerOk');
    const cancelBtn = document.getElementById('markerCancel');
    if (!modal || !input) return;

    /** Сохраняем координаты pending-маркера */
    pendingMarker = { px, py };

    /** Показываем модалку */
    modal.classList.remove('hidden');

    /** Фокус на input + выделение текста */
    input.value = '';
    requestAnimationFrame(() => {
      input.focus();
      input.select();
    });

    /** Обработчик OK */
    function onOk() {
      const label = input.value.trim() || (STR ? (STR.markerDefault || 'Метка') : 'Метка');
      cleanup();
      /** Создаём и сохраняем маркер */
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

    /** Обработчик Cancel / закрытие */
    function onCancel() {
      cleanup();
      pendingMarker = null;
    }

    /** Закрытие по Escape */
    function onKey(e) {
      if (e.key === 'Enter') { e.preventDefault(); onOk(); }
      else if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
    }

    /** Снятие обработчиков */
    function cleanup() {
      _cleanupModal = null;
      modal.classList.add('hidden');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      input.removeEventListener('keydown', onKey);
      modal.removeEventListener('mousedown', onBackdrop);
    }

    /** Клик по backdrop (вне модалки) → отмена */
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
    configure, setOnStrokeComplete,
    setTool, setWidth, getTool, getWidth,
    getLocalDrawings, getCurrentStroke, isActive,
    startStroke, continueStroke, finishStroke, cancelStroke,
    eraseAt, clearDrawings, showMarkerModal, hideMarkerModal
  };
})(window.AppUtils);
