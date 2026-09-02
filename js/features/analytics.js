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
 * Экспорт: window.AppAnalytics
 */

window.AppAnalytics = (function () {

    /**
     * Отправляет событие в Яндекс.Метрику и GA4.
     *
     * @param {string} goalId  — идентификатор цели YM
     * @param {string} gaEvent — имя события для GA4
     * @param {object} [params] — дополнительные параметры
     */
    function track(goalId, gaEvent, params) {
        /** Яндекс.Метрика: достижение цели */
        if (typeof ym === 'function') {
            ym(111625912, 'reachGoal', goalId, params || {});
        }

        /** Google Analytics: событие через dataLayer */
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
            event: gaEvent,
            ...(params || {}),
        });
    }

    /**
     * Привязывает обработчики кликов к DOM-элементам
     * при готовности DOM.
     */
    function init() {
        /** ── Discord ────────────────────────────────── */
        const discordIds = ['discordQr', 'discordBtn'];
        discordIds.forEach(function (id) {
            var el = document.getElementById(id);
            if (el) {
                el.addEventListener('click', function () {
                    track('discord_qr_click', 'discord_click', {
                        creative_name: id,
                    });
                });
            }
        });

        /** Footer Discord-ссылка (нет id, ищем по href) */
        var footerDiscord = document.querySelector(
            'footer a[href*="discord.gg"]'
        );
        if (footerDiscord) {
            footerDiscord.addEventListener('click', function () {
                track('discord_qr_click', 'discord_click', {
                    creative_name: 'footer',
                });
            });
        }

        /** ── Email ──────────────────────────────────── */
        /** Все ссылки mailto: на странице (панель + footer) */
        var emailLinks = document.querySelectorAll('a[href^="mailto:"]');
        emailLinks.forEach(function (el) {
            el.addEventListener('click', function () {
                track('email_click', 'email_click', {
                    email_target: el.getAttribute('href').replace('mailto:', ''),
                });
            });
        });
    }

    return { init: init };
})();
