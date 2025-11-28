/**
 * Chalk Compatibility Layer
 * Provides chalk-like API using built-in ANSI colors
 */

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m'
};

class Chalk {
  constructor() {
    // Create color methods
    Object.keys(colors).forEach(color => {
      this[color] = (text) => {
        if (color === 'reset') return colors.reset;
        return `${colors[color]}${text}${colors.reset}`;
      };
    });

    // Modifiers
    this.bold = (text) => `${colors.bright}${text}${colors.reset}`;
    this.dim = (text) => `${colors.dim}${text}${colors.reset}`;
  }
}

module.exports = new Chalk();
