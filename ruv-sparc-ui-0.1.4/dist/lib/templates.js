"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.templatesToPrompt = templatesToPrompt;
var templates_json_1 = __importDefault(require("./templates.json"));
exports.default = templates_json_1.default;
function templatesToPrompt(templates) {
    return "".concat(Object.entries(templates).map(function (_a, index) {
        var id = _a[0], t = _a[1];
        return "".concat(index + 1, ". ").concat(id, ": \"").concat(t.instructions, "\". File: ").concat(t.file || 'none', ". Dependencies installed: ").concat(t.lib.join(', '), ". Port: ").concat(t.port || 'none', ".");
    }).join('\n'));
}
//# sourceMappingURL=templates.js.map