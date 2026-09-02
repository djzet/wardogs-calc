/**
 * Аналитика: отслеживание кликов
 *
 * Отправляет события в:
 * - Яндекс.Метрику (reachGoal) для отслеживания целей
 * - Google Analytics (gtag event) через dataLayer
 *
 * Цели Яндекс.Метрики:
 *   discord_qr_click (ID 597848750) — клики по Discord
 *   email_click      (ID 597834329) — клики по email-адресам
 *
 * @module AppAnalytics
 */

/** ID счётчика Яндекс.Метрики */
const YM_COUNTER_ID = 111625912;

/** CSS-селекторы Discord-элементов (panel + footer) */
const DISCORD_ELEMENT_IDS = ['discordQr', 'discordBtn'];
const DISCORD_FOOTER_SELECTOR = 'footer a[href*="discord.gg"]';

/** CSS-селектор всех email-ссылок */
const EMAIL_LINK_SELECTOR = 'a[href^="mailto:"]';

/**
 * Отправляет событие в Яндекс.Метрику и GA4.
 *
 * @param {string} goalId  — идентификатор цели YM
 * @param {string} gaEvent — имя события для GA4
 * @param {object} [params] — дополнительные параметры
 */
const track = (goalId, gaEvent, params = {}) => {
    // Яндекс.Метрика: достижение цели
    if (typeof ym === 'function') {
        ym(YM_COUNTER_ID, 'reachGoal', goalId, params);
    }

    // Google Analytics: событие через dataLayer
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: gaEvent, ...params });
};

/**
 * Привязывает обработчик клика с трекингом к элементу.
 *
 * @param {Element|null} element   — DOM-элемент
 * @param {string}       goalId    — идентификатор цели YM
 * @param {string}       gaEvent   — имя события GA4
 * @param {object}       [params]  — дополнительные параметры
 */
const bindTrack = (element, goalId, gaEvent, params) => {
    element?.addEventListener('click', () => track(goalId, gaEvent, params));
};

/**
 * Привязывает обработчики кликов к DOM-элементам при готовности DOM.
 */
const init = () => {
    // ── Discord ──────────────────────────────────────
    DISCORD_ELEMENT_IDS.forEach((id) => {
        const el = document.getElementById(id);
        bindTrack(el, 'discord_qr_click', 'discord_click', { creative_name: id });
    });

    // Footer Discord-ссылка (нет id, ищем по href)
    bindTrack(
        document.querySelector(DISCORD_FOOTER_SELECTOR),
        'discord_qr_click',
        'discord_click',
        { creative_name: 'footer' }
    );

    // ── Email ────────────────────────────────────────
    // Все ссылки mailto: на странице (панель + footer)
    document.querySelectorAll(EMAIL_LINK_SELECTOR).forEach((el) => {
        bindTrack(el, 'email_click', 'email_click', {
            email_target: el.getAttribute('href').replace('mailto:', ''),
        });
    });
};

// Экспорт на window для обратной совместимости с js/index.js
window.AppAnalytics = { init };
