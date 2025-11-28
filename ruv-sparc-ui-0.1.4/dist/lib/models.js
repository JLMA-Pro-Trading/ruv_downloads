"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getModelClient = getModelClient;
exports.getDefaultMode = getDefaultMode;
var anthropic_1 = require("@ai-sdk/anthropic");
var google_1 = require("@ai-sdk/google");
var google_vertex_1 = require("@ai-sdk/google-vertex");
var mistral_1 = require("@ai-sdk/mistral");
var openai_1 = require("@ai-sdk/openai");
var ollama_ai_provider_1 = require("ollama-ai-provider");
function getModelClient(model, config) {
    var modelNameString = model.id, providerId = model.providerId;
    var apiKey = config.apiKey, baseURL = config.baseURL;
    var providerConfigs = {
        anthropic: function () { return (0, anthropic_1.createAnthropic)({ apiKey: apiKey, baseURL: baseURL })(modelNameString); },
        openai: function () { return (0, openai_1.createOpenAI)({ apiKey: apiKey, baseURL: baseURL })(modelNameString); },
        google: function () {
            return (0, google_1.createGoogleGenerativeAI)({ apiKey: apiKey, baseURL: baseURL })(modelNameString);
        },
        mistral: function () { return (0, mistral_1.createMistral)({ apiKey: apiKey, baseURL: baseURL })(modelNameString); },
        groq: function () {
            return (0, openai_1.createOpenAI)({
                apiKey: apiKey || process.env.GROQ_API_KEY,
                baseURL: baseURL || 'https://api.groq.com/openai/v1',
            })(modelNameString);
        },
        togetherai: function () {
            return (0, openai_1.createOpenAI)({
                apiKey: apiKey || process.env.TOGETHER_API_KEY,
                baseURL: baseURL || 'https://api.together.xyz/v1',
            })(modelNameString);
        },
        ollama: function () { return (0, ollama_ai_provider_1.createOllama)({ baseURL: baseURL })(modelNameString); },
        fireworks: function () {
            return (0, openai_1.createOpenAI)({
                apiKey: apiKey || process.env.FIREWORKS_API_KEY,
                baseURL: baseURL || 'https://api.fireworks.ai/inference/v1',
            })(modelNameString);
        },
        vertex: function () {
            return (0, google_vertex_1.createVertex)({
                googleAuthOptions: {
                    credentials: JSON.parse(process.env.GOOGLE_VERTEX_CREDENTIALS || '{}'),
                },
            })(modelNameString);
        },
        xai: function () {
            return (0, openai_1.createOpenAI)({
                apiKey: apiKey || process.env.XAI_API_KEY,
                baseURL: baseURL || 'https://api.x.ai/v1',
            })(modelNameString);
        },
    };
    var createClient = providerConfigs[providerId];
    if (!createClient) {
        throw new Error("Unsupported provider: ".concat(providerId));
    }
    return createClient();
}
function getDefaultMode(model) {
    var modelNameString = model.id, providerId = model.providerId;
    // monkey patch fireworks
    if (providerId === 'fireworks') {
        return 'json';
    }
    return 'auto';
}
//# sourceMappingURL=models.js.map