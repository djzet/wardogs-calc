// Entry point — порядок импортов = порядок зависимостей (side-effect IIFE → window.*)

import '../styles/variables.css';
import '../styles/base.css';
import '../styles/panel.css';
import '../styles/map.css';
import '../styles/overlays.css';
import '../styles/mobile.css';

import '../config/app.js';
import '../config/weapons.js';

import '../js/core/utils.js';
import '../js/core/calculator.js';

import '../js/features/storage.js';
import '../js/features/share.js';
import '../js/features/points.js';
import '../js/features/analytics.js';
import '../js/features/draw.js';
import '../js/features/weapons.js';
import '../js/features/lobby.js';

import '../js/map/tiles.js';
import '../js/map/renderer.js';
import '../js/map/interactions.js';
import '../js/map/viewport.js';

import '../js/ui/panels.js';
import '../js/ui/inputs.js';
import '../js/ui/contextMenu.js';
import '../js/ui/results.js';

import '../js/locales/index.js';
import '../js/index.js';
