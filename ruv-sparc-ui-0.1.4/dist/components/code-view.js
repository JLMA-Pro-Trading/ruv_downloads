"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeView = CodeView;
var jsx_runtime_1 = require("react/jsx-runtime");
// import "prismjs/plugins/line-numbers/prism-line-numbers.js";
// import "prismjs/plugins/line-numbers/prism-line-numbers.css";
require("./code-theme.css");
var prismjs_1 = __importDefault(require("prismjs"));
require("prismjs/components/prism-javascript");
require("prismjs/components/prism-jsx");
require("prismjs/components/prism-python");
require("prismjs/components/prism-tsx");
require("prismjs/components/prism-typescript");
var react_1 = require("react");
function CodeView(_a) {
    var code = _a.code, lang = _a.lang;
    (0, react_1.useEffect)(function () {
        prismjs_1.default.highlightAll();
    }, [code]);
    return ((0, jsx_runtime_1.jsx)("pre", { className: "p-4 pt-2", style: {
            fontSize: 12,
            backgroundColor: 'transparent',
            borderRadius: 0,
            margin: 0,
        }, children: (0, jsx_runtime_1.jsx)("code", { className: "language-".concat(lang), children: code }) }));
}
//# sourceMappingURL=code-view.js.map