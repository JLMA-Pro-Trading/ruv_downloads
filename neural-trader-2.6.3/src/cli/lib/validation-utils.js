/**
 * Validation Utilities
 * Simple validation functions for CLI inputs
 */

/**
 * Validate that a string parameter is provided and not empty
 * @param {any} value - Value to validate
 * @param {string} paramName - Parameter name for error message
 * @returns {string} The validated string value
 * @throws {Error} If value is not a valid non-empty string
 */
function validateRequiredString(value, paramName) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${paramName} must be a non-empty string`);
  }
  return value.trim();
}

/**
 * Validate that a number parameter is provided and is a valid number
 * @param {any} value - Value to validate
 * @param {string} paramName - Parameter name for error message
 * @param {Object} options - Optional validation options
 * @param {number} options.min - Minimum allowed value
 * @param {number} options.max - Maximum allowed value
 * @returns {number} The validated number value
 * @throws {Error} If value is not a valid number or out of range
 */
function validateRequiredNumber(value, paramName, options = {}) {
  const num = Number(value);

  if (isNaN(num)) {
    throw new Error(`${paramName} must be a valid number`);
  }

  if (options.min !== undefined && num < options.min) {
    throw new Error(`${paramName} must be at least ${options.min}`);
  }

  if (options.max !== undefined && num > options.max) {
    throw new Error(`${paramName} must be at most ${options.max}`);
  }

  return num;
}

/**
 * Validate that a boolean parameter is provided and is a valid boolean
 * @param {any} value - Value to validate
 * @param {string} paramName - Parameter name for error message
 * @returns {boolean} The validated boolean value
 */
function validateRequiredBoolean(value, paramName) {
  if (typeof value !== 'boolean') {
    throw new Error(`${paramName} must be a boolean`);
  }
  return value;
}

/**
 * Validate that an array parameter is provided and is a valid array
 * @param {any} value - Value to validate
 * @param {string} paramName - Parameter name for error message
 * @param {Object} options - Optional validation options
 * @param {number} options.minLength - Minimum array length
 * @param {number} options.maxLength - Maximum array length
 * @returns {Array} The validated array value
 * @throws {Error} If value is not a valid array or out of length range
 */
function validateRequiredArray(value, paramName, options = {}) {
  if (!Array.isArray(value)) {
    throw new Error(`${paramName} must be an array`);
  }

  if (options.minLength !== undefined && value.length < options.minLength) {
    throw new Error(`${paramName} must have at least ${options.minLength} elements`);
  }

  if (options.maxLength !== undefined && value.length > options.maxLength) {
    throw new Error(`${paramName} must have at most ${options.maxLength} elements`);
  }

  return value;
}

/**
 * Validate that an object parameter is provided and is a valid object
 * @param {any} value - Value to validate
 * @param {string} paramName - Parameter name for error message
 * @returns {Object} The validated object value
 * @throws {Error} If value is not a valid object
 */
function validateRequiredObject(value, paramName) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${paramName} must be a valid object`);
  }
  return value;
}

/**
 * Validate that a date string is a valid ISO date
 * @param {any} value - Value to validate
 * @param {string} paramName - Parameter name for error message
 * @returns {string} The validated date string
 * @throws {Error} If value is not a valid date string
 */
function validateDateString(value, paramName) {
  if (typeof value !== 'string') {
    throw new Error(`${paramName} must be a string`);
  }

  const date = new Date(value);
  if (isNaN(date.getTime())) {
    throw new Error(`${paramName} must be a valid ISO date string`);
  }

  return value;
}

/**
 * Validate an optional parameter (returns undefined if not provided)
 * @param {any} value - Value to validate
 * @param {Function} validator - Validation function to apply if value is provided
 * @param {...any} args - Additional arguments for the validator function
 * @returns {any} The validated value or undefined
 */
function validateOptional(value, validator, ...args) {
  if (value === undefined || value === null) {
    return undefined;
  }
  return validator(value, ...args);
}

/**
 * Validate that a value is one of the allowed enum values
 * @param {any} value - Value to validate
 * @param {string} paramName - Parameter name for error message
 * @param {Array} allowedValues - Array of allowed values
 * @returns {any} The validated value
 * @throws {Error} If value is not in the allowed values
 */
function validateEnum(value, paramName, allowedValues) {
  if (!allowedValues.includes(value)) {
    throw new Error(
      `${paramName} must be one of: ${allowedValues.join(', ')}. Got: ${value}`
    );
  }
  return value;
}

module.exports = {
  validateRequiredString,
  validateRequiredNumber,
  validateRequiredBoolean,
  validateRequiredArray,
  validateRequiredObject,
  validateDateString,
  validateOptional,
  validateEnum
};
