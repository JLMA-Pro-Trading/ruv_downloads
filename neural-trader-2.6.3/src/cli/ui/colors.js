/**
 * Color utilities for CLI output
 * Provides consistent color scheme across the application
 * Uses ANSI codes for maximum compatibility
 */

/**
 * ANSI Color Codes
 */
const ansiColors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underline: '\x1b[4m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

/**
 * Color helper functions
 */
const colorFn = (color, text) => `${color}${text}${ansiColors.reset}`;

/**
 * Color theme using ANSI codes
 */
const colors = {
  // Status colors
  success: (text) => colorFn(ansiColors.green, text),
  error: (text) => colorFn(ansiColors.red, text),
  warning: (text) => colorFn(ansiColors.yellow, text),
  info: (text) => colorFn(ansiColors.blue, text),

  // Brand colors
  primary: (text) => colorFn(ansiColors.cyan, text),
  secondary: (text) => colorFn(ansiColors.magenta, text),

  // Text styles
  bold: (text) => colorFn(ansiColors.bright, text),
  dim: (text) => colorFn(ansiColors.dim, text),
  italic: (text) => text, // ANSI italic not widely supported

  // Semantic colors
  heading: (text) => colorFn(ansiColors.bright + ansiColors.cyan, text),
  subheading: (text) => colorFn(ansiColors.cyan, text),
  highlight: (text) => colorFn(ansiColors.bright, text),
  muted: (text) => colorFn(ansiColors.dim, text),

  // Special
  link: (text) => colorFn(ansiColors.blue + ansiColors.underline, text),
  code: (text) => colorFn(ansiColors.yellow, text)
};

/**
 * Colorize text with semantic meaning
 * @param {string} text - Text to colorize
 * @param {string} type - Color type (success, error, warning, info, etc.)
 * @returns {string} Colorized text
 */
function colorize(text, type = 'info') {
  if (colors[type]) {
    return colors[type](text);
  }
  return text;
}

/**
 * Create a gradient text effect
 * @param {string} text - Text to gradient
 * @returns {string} Gradient text
 */
function gradient(text) {
  // Simple gradient simulation using chalk
  return chalk.cyan.bold(text);
}

/**
 * Format a status message with icon
 * @param {string} status - Status type (success, error, warning, info)
 * @param {string} message - Message text
 * @returns {string} Formatted status message
 */
function formatStatus(status, message) {
  const icons = {
    success: '✓',
    error: '✗',
    warning: '⚠',
    info: 'ℹ'
  };

  const icon = icons[status] || '•';
  const color = colors[status] || colors.info;

  return `${color(icon)} ${message}`;
}

module.exports = {
  colors,
  ansiColors,
  colorize,
  gradient,
  formatStatus
};
