/**
 * Table formatting utilities for CLI output
 * Uses cli-table3 for rich table displays
 */

const Table = require('cli-table3');
const { colors } = require('./colors');

/**
 * Create a styled table
 * @param {Object} options - Table options
 * @returns {Table} Configured table instance
 */
function createTable(options = {}) {
  const defaultOptions = {
    chars: {
      'top': '─',
      'top-mid': '┬',
      'top-left': '┌',
      'top-right': '┐',
      'bottom': '─',
      'bottom-mid': '┴',
      'bottom-left': '└',
      'bottom-right': '┘',
      'left': '│',
      'left-mid': '├',
      'mid': '─',
      'mid-mid': '┼',
      'right': '│',
      'right-mid': '┤',
      'middle': '│'
    },
    style: {
      head: ['cyan', 'bold'],
      border: ['dim']
    }
  };

  return new Table({ ...defaultOptions, ...options });
}

/**
 * Create a package listing table
 * @param {Array} packages - Array of package objects
 * @returns {string} Formatted table
 */
function createPackageTable(packages) {
  const table = createTable({
    head: ['Name', 'Description', 'Category'],
    colWidths: [25, 50, 15]
  });

  packages.forEach(pkg => {
    table.push([
      colors.bold(pkg.name),
      pkg.description,
      colors.dim(pkg.category)
    ]);
  });

  return table.toString();
}

/**
 * Create a key-value table
 * @param {Object} data - Key-value pairs
 * @returns {string} Formatted table
 */
function createKeyValueTable(data) {
  const table = createTable({
    head: ['Property', 'Value'],
    colWidths: [25, 55]
  });

  Object.entries(data).forEach(([key, value]) => {
    table.push([
      colors.bold(key),
      typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)
    ]);
  });

  return table.toString();
}

/**
 * Create a status table
 * @param {Array} items - Array of status items
 * @returns {string} Formatted table
 */
function createStatusTable(items) {
  const table = createTable({
    head: ['Status', 'Component', 'Details'],
    colWidths: [10, 25, 45]
  });

  items.forEach(item => {
    const statusIcon = item.status === 'ok' ? colors.success('✓') :
                       item.status === 'error' ? colors.error('✗') :
                       colors.warning('⚠');

    table.push([
      statusIcon,
      colors.bold(item.component),
      colors.dim(item.details)
    ]);
  });

  return table.toString();
}

/**
 * Create a simple list table
 * @param {Array} items - Array of items
 * @param {string} title - Optional title
 * @returns {string} Formatted table
 */
function createListTable(items, title) {
  const table = createTable({
    head: title ? [title] : []
  });

  items.forEach(item => {
    table.push([typeof item === 'object' ? JSON.stringify(item) : String(item)]);
  });

  return table.toString();
}

module.exports = {
  createTable,
  createPackageTable,
  createKeyValueTable,
  createStatusTable,
  createListTable
};
