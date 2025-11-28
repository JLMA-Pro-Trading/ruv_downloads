"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.FragmentPreview = FragmentPreview;
var jsx_runtime_1 = require("react/jsx-runtime");
var fragment_interpreter_1 = require("./fragment-interpreter");
var fragment_web_1 = require("./fragment-web");
function FragmentPreview(_a) {
    var result = _a.result;
    if (result.template === 'code-interpreter-v1') {
        return (0, jsx_runtime_1.jsx)(fragment_interpreter_1.FragmentInterpreter, { result: result });
    }
    return (0, jsx_runtime_1.jsx)(fragment_web_1.FragmentWeb, { result: result });
}
//# sourceMappingURL=fragment-preview.js.map