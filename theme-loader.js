/**
 * PICO IOT Theme Loader
 * This script is intended to be placed in the <head> of the document.
 * It runs synchronously before the page content is rendered to prevent FOUC (Flash of Unstyled Content).
 * It checks localStorage for a saved theme and applies it to the root <html> element.
 */
(function() {
  try {
    // Attempt to get the theme from localStorage.
    const savedTheme = localStorage.getItem('pico-theme');
    
    // If a theme is found, apply it to the <html> element.
    if (savedTheme) {
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
    // If no theme is found, the page will use the default theme defined in the CSS.
  } catch (e) {
    // Catch potential errors if localStorage is disabled or unavailable.
    console.error('Failed to load theme from localStorage:', e);
  }
})();
