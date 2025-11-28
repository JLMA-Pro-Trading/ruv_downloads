/**
 * Box and banner utilities for CLI
 * Creates visually appealing boxed content
 */

const { colors } = require('./colors');

/**
 * Create a simple box around text
 * @param {string} content - Content to box
 * @param {Object} options - Box options
 * @returns {string} Boxed content
 */
function createBox(content, options = {}) {
  const lines = content.split('\n');
  const maxLength = Math.max(...lines.map(l => l.length));
  const width = Math.min(maxLength + 4, options.width || 80);

  const border = {
    top: options.char || '═',
    side: options.char || '║',
    corner: options.char || '╔'
  };

  const topBorder = border.corner + border.top.repeat(width - 2) + border.corner.replace('╔', '╗');
  const bottomBorder = border.corner.replace('╔', '╚') + border.top.repeat(width - 2) + border.corner.replace('╔', '╝');

  const boxedLines = [topBorder];
  lines.forEach(line => {
    const paddedLine = line.padEnd(width - 4);
    boxedLines.push(`${border.side} ${paddedLine} ${border.side}`);
  });
  boxedLines.push(bottomBorder);

  return boxedLines.join('\n');
}

/**
 * Create a banner with title
 * @param {string} title - Banner title
 * @param {string} subtitle - Optional subtitle
 * @returns {string} Banner text
 */
function createBanner(title, subtitle) {
  const lines = [
    '',
    '╔══════════════════════════════════════════════════════════════╗',
    `║  ${title.padEnd(58)}  ║`,
  ];

  if (subtitle) {
    lines.push(`║  ${subtitle.padEnd(58)}  ║`);
  }

  lines.push(
    '╚══════════════════════════════════════════════════════════════╝',
    ''
  );

  // Apply cyan color to the whole banner
  const banner = lines.join('\n');
  return colors.primary(banner);
}

/**
 * Create the Neural Trader banner
 * @returns {string} Neural Trader banner
 */
function createNeuralTraderBanner() {
  return createBanner(
    'Neural Trader - High-Performance Trading & Analytics',
    'GPU-Accelerated • Real-Time • Self-Learning • 30+ Packages'
  );
}

/**
 * Create a section header
 * @param {string} title - Section title
 * @returns {string} Formatted section header
 */
function createSection(title) {
  return `\n${colors.heading('▓▒░ ' + title + ' ░▒▓')}\n`;
}

/**
 * Create a divider line
 * @param {number} length - Line length
 * @param {string} char - Character to use
 * @returns {string} Divider line
 */
function createDivider(length = 60, char = '─') {
  return colors.dim(char.repeat(length));
}

/**
 * Create an info box with icon
 * @param {string} message - Message to display
 * @param {string} type - Box type (info, success, warning, error)
 * @returns {string} Info box
 */
function createInfoBox(message, type = 'info') {
  const icons = {
    info: 'ℹ',
    success: '✓',
    warning: '⚠',
    error: '✗'
  };

  const typeColors = {
    info: colors.info,
    success: colors.success,
    warning: colors.warning,
    error: colors.error
  };

  const icon = icons[type] || icons.info;
  const colorFn = typeColors[type] || typeColors.info;

  return colorFn(`\n┌─ ${icon} ─────────────────────────────────────────────┐\n│ ${message.padEnd(46)} │\n└───────────────────────────────────────────────────┘\n`);
}

module.exports = {
  createBox,
  createBanner,
  createNeuralTraderBanner,
  createSection,
  createDivider,
  createInfoBox
};
