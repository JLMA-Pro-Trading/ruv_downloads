/**
 * UI Components Export
 * Central export point for all UI utilities
 */

const colors = require('./colors');
const tables = require('./tables');
const spinners = require('./spinners');
const boxes = require('./boxes');

module.exports = {
  ...colors,
  ...tables,
  ...spinners,
  ...boxes
};
