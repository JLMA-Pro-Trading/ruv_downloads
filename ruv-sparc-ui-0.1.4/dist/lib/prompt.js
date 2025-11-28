"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toPrompt = toPrompt;
var templates_1 = require("@/lib/templates");
function toPrompt(template) {
    return "\n    You are a skilled software engineer.\n    You do not make mistakes.\n    Generate an fragment.\n    You can install additional dependencies.\n    Do not touch project dependencies files like package.json, package-lock.json, requirements.txt, etc.\n    You can use one of the following templates:\n    ".concat((0, templates_1.templatesToPrompt)(template), "\n  ");
}
//# sourceMappingURL=prompt.js.map