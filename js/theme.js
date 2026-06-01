// ============================================================
//  theme.js — EduVerse Theme Toggle System
//  Handles: dark/light mode, localStorage persistence
// ============================================================

(function () {
    // ── Constants ─────────────────────────────────────────────
    const STORAGE_KEY = 'eduverse-theme';
    const LIGHT = 'light';
    const DARK = 'dark';

    // ── Apply theme to <html> element ─────────────────────────
    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem(STORAGE_KEY, theme);
        updateToggleButtons(theme);
    }

    // ── Update all toggle button labels & icons ───────────────
    function updateToggleButtons(theme) {
        const buttons = document.querySelectorAll('.theme-toggle');
        buttons.forEach(function (btn) {
            const icon = btn.querySelector('.icon');
            const label = btn.querySelector('.label');
            if (icon) icon.textContent = (theme === DARK) ? '☀️' : '🌙';
            if (label) label.textContent = (theme === DARK) ? 'Light Mode' : 'Dark Mode';
        });
    }

    // ── Toggle between dark and light ─────────────────────────
    function toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme') || LIGHT;
        applyTheme(current === DARK ? LIGHT : DARK);
    }

    // ── Initialize on page load ───────────────────────────────
    function init() {
        // Read saved preference, default to light
        const saved = localStorage.getItem(STORAGE_KEY) || LIGHT;
        applyTheme(saved);

        // Attach click handlers to all toggle buttons on the page
        document.addEventListener('click', function (e) {
            const btn = e.target.closest('.theme-toggle');
            if (btn) toggleTheme();
        });
    }

    // Run immediately (before DOM is fully loaded) to avoid theme flash
    const savedEarly = localStorage.getItem(STORAGE_KEY);
    if (savedEarly) {
        document.documentElement.setAttribute('data-theme', savedEarly);
    }

    // Wait for DOM before attaching event listeners
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
