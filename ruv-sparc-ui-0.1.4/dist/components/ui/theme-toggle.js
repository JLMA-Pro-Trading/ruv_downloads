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
exports.ThemeToggle = void 0;
var jsx_runtime_1 = require("react/jsx-runtime");
var button_1 = require("@/components/ui/button");
var lucide_react_1 = require("lucide-react");
var next_themes_1 = require("next-themes");
var react_1 = require("react");
exports.ThemeToggle = (0, react_1.forwardRef)(function (_a, ref) {
    var className = _a.className, props = __rest(_a, ["className"]);
    var _b = (0, next_themes_1.useTheme)(), setTheme = _b.setTheme, theme = _b.theme;
    var _c = (0, react_1.useState)(false), mounted = _c[0], setMounted = _c[1];
    // useEffect only runs on the client, so now we can safely show the UI
    (0, react_1.useEffect)(function () {
        setMounted(true);
    }, []);
    if (!mounted) {
        return null;
    }
    return ((0, jsx_runtime_1.jsx)(button_1.Button, __assign({}, props, { ref: ref, variant: "ghost", size: "icon", className: className, onClick: function () { return setTheme(theme === 'dark' ? 'light' : 'dark'); }, children: theme === 'light' ? ((0, jsx_runtime_1.jsx)(lucide_react_1.SunIcon, { className: "h-4 w-4 md:h-5 md:w-5" })) : ((0, jsx_runtime_1.jsx)(lucide_react_1.MoonIcon, { className: "h-4 w-4 md:h-5 md:w-5" })) })));
});
exports.ThemeToggle.displayName = 'ThemeToggle';
//# sourceMappingURL=theme-toggle.js.map