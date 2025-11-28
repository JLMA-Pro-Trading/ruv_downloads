"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CopyButton = void 0;
var jsx_runtime_1 = require("react/jsx-runtime");
var button_1 = require("./button");
var lucide_react_1 = require("lucide-react");
var react_1 = require("react");
exports.CopyButton = (0, react_1.forwardRef)(function (_a, ref) {
    var _b = _a.variant, variant = _b === void 0 ? 'ghost' : _b, content = _a.content, onCopy = _a.onCopy, className = _a.className, props = __rest(_a, ["variant", "content", "onCopy", "className"]);
    var _c = (0, react_1.useState)(false), copied = _c[0], setCopied = _c[1];
    function copy(content) {
        setCopied(true);
        navigator.clipboard.writeText(content);
        setTimeout(function () { return setCopied(false); }, 1000);
        onCopy === null || onCopy === void 0 ? void 0 : onCopy();
    }
    return ((0, jsx_runtime_1.jsx)(button_1.Button, __assign({}, props, { ref: ref, variant: variant, size: "icon", className: className, onClick: function () { return copy(content); }, children: copied ? (0, jsx_runtime_1.jsx)(lucide_react_1.Check, { className: "h-4 w-4" }) : (0, jsx_runtime_1.jsx)(lucide_react_1.Copy, { className: "h-4 w-4" }) })));
});
exports.CopyButton.displayName = 'CopyButton';
//# sourceMappingURL=copy-button.js.map