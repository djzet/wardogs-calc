/**
 * Мост между виртуальным модулем virtual:locale-data и window.*.
 *
 * В dev-режиме Vite НЕ резолвит virtual:locale-data (плагин inactive),
 * поэтому модуль экспортирует null → locales.js продолжает использовать fetch().
 *
 * В build-режиме плагин inlineLocales() генерирует JS-модуль со всеми переводами,
 * и они доступны мгновенно через window.__INLINED_LOCALES__.
 */
import data from 'virtual:locale-data';
window.__INLINED_LOCALES__ = data;
