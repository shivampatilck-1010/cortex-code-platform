/**
 * Codex Browser — Custom User Preload Script
 * This script is executed in the webview session before the exam page scripts run.
 * You can hook into page events, polyfill features, or inject customizations here.
 */

console.log('[Codex Custom Preload] Custom user preload script active.');

// Example hook: Listen for exam page events
window.addEventListener('DOMContentLoaded', () => {
  console.log('[Codex Custom Preload] Exam page DOM loaded.');
});
