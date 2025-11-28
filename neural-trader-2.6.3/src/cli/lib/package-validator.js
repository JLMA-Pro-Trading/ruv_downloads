/**
 * Package Validator - Package validation
 * STUB IMPLEMENTATION
 */

class PackageValidator {
  validate(packageConfig) {
    // Stub: always valid
    return {
      valid: true,
      errors: [],
      warnings: []
    };
  }

  validateDependencies(dependencies) {
    return {
      valid: true,
      missing: [],
      conflicts: []
    };
  }

  validateVersion(version) {
    return {
      valid: true,
      message: 'Version valid'
    };
  }
}

module.exports = PackageValidator;
