const YM_COUNTER_ID = 111625912;
const DISCORD_ELEMENT_IDS = ['discordQr', 'discordBtn'];
const DISCORD_FOOTER_SELECTOR = 'footer a[href*="discord.gg"]';
const EMAIL_LINK_SELECTOR = 'a[href^="mailto:"]';
const track = (goalId, gaEvent, params = {}) => {
    if (typeof ym === 'function') {
        ym(YM_COUNTER_ID, 'reachGoal', goalId, params);
    }
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: gaEvent, ...params });
};
const bindTrack = (element, goalId, gaEvent, params) => {
    element?.addEventListener('click', () => track(goalId, gaEvent, params));
};
const init = () => {
    DISCORD_ELEMENT_IDS.forEach((id) => {
        const el = document.getElementById(id);
        bindTrack(el, 'discord_qr_click', 'discord_click', { creative_name: id });
    });
    bindTrack(
        document.querySelector(DISCORD_FOOTER_SELECTOR),
        'discord_qr_click',
        'discord_click',
        { creative_name: 'footer' }
    );
    document.querySelectorAll(EMAIL_LINK_SELECTOR).forEach((el) => {
        bindTrack(el, 'email_click', 'email_click', {
            email_target: el.getAttribute('href').replace('mailto:', ''),
        });
    });
};
window.AppAnalytics = { init };