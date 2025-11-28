/**
 * Spinner and progress utilities for CLI
 * Uses ora for beautiful loading indicators
 */

const ora = require('ora');
const { colors } = require('./colors');

/**
 * Create a spinner with default styling
 * @param {string} text - Spinner text
 * @param {Object} options - Spinner options
 * @returns {Object} Ora spinner instance
 */
function createSpinner(text, options = {}) {
  return ora({
    text: text,
    color: 'cyan',
    spinner: 'dots',
    ...options
  });
}

/**
 * Run an async operation with a spinner
 * @param {string} text - Loading text
 * @param {Function} fn - Async function to execute
 * @param {Object} messages - Success/error messages
 * @returns {Promise<*>} Result of the async function
 */
async function withSpinner(text, fn, messages = {}) {
  const spinner = createSpinner(text);
  spinner.start();

  try {
    const result = await fn();
    spinner.succeed(messages.success || 'Done');
    return result;
  } catch (error) {
    spinner.fail(messages.error || 'Failed');
    throw error;
  }
}

/**
 * Create a multi-step progress indicator
 * @param {Array<Object>} steps - Array of steps {text, fn}
 * @returns {Promise<Array>} Results of all steps
 */
async function withProgress(steps) {
  const results = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const spinner = createSpinner(`[${i + 1}/${steps.length}] ${step.text}`);
    spinner.start();

    try {
      const result = await step.fn();
      spinner.succeed();
      results.push(result);
    } catch (error) {
      spinner.fail();
      throw error;
    }
  }

  return results;
}

/**
 * Show a simple loading message
 * @param {string} text - Loading text
 * @returns {Object} Spinner instance
 */
function showLoading(text) {
  return createSpinner(text).start();
}

/**
 * Show success message
 * @param {string} text - Success text
 */
function showSuccess(text) {
  ora().succeed(colors.success(text));
}

/**
 * Show error message
 * @param {string} text - Error text
 */
function showError(text) {
  ora().fail(colors.error(text));
}

/**
 * Show warning message
 * @param {string} text - Warning text
 */
function showWarning(text) {
  ora().warn(colors.warning(text));
}

/**
 * Show info message
 * @param {string} text - Info text
 */
function showInfo(text) {
  ora().info(colors.info(text));
}

module.exports = {
  createSpinner,
  withSpinner,
  withProgress,
  showLoading,
  showSuccess,
  showError,
  showWarning,
  showInfo
};
