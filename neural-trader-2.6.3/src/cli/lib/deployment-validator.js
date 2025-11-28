/**
 * Deployment Validator - Validate deployment configurations
 * STUB IMPLEMENTATION
 */

class DeploymentValidator {
  validate(config) {
    // Stub: always valid
    return {
      valid: true,
      errors: [],
      warnings: []
    };
  }

  validateE2B(config) {
    return {
      valid: true,
      errors: []
    };
  }

  validateFlowNexus(config) {
    return {
      valid: true,
      errors: []
    };
  }

  validateResources(resources) {
    return {
      valid: true,
      sufficient: true
    };
  }
}

module.exports = DeploymentValidator;
