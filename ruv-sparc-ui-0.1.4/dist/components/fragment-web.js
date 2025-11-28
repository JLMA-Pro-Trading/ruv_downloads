"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FragmentWeb = FragmentWeb;
var jsx_runtime_1 = require("react/jsx-runtime");
var copy_button_1 = require("./ui/copy-button");
var button_1 = require("@/components/ui/button");
var tooltip_1 = require("@/components/ui/tooltip");
var lucide_react_1 = require("lucide-react");
var react_1 = require("react");
function FragmentWeb(_a) {
    var result = _a.result;
    var _b = (0, react_1.useState)(0), iframeKey = _b[0], setIframeKey = _b[1];
    if (!result)
        return null;
    function refreshIframe() {
        setIframeKey(function (prevKey) { return prevKey + 1; });
    }
    return ((0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col w-full h-full", children: [(0, jsx_runtime_1.jsx)("iframe", { className: "h-full w-full", sandbox: "allow-forms allow-scripts allow-same-origin", loading: "lazy", src: result.url }, iframeKey), (0, jsx_runtime_1.jsx)("div", { className: "p-2 border-t", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center bg-muted dark:bg-white/10 rounded-2xl", children: [(0, jsx_runtime_1.jsx)(tooltip_1.TooltipProvider, { children: (0, jsx_runtime_1.jsxs)(tooltip_1.Tooltip, { delayDuration: 0, children: [(0, jsx_runtime_1.jsx)(tooltip_1.TooltipTrigger, { asChild: true, children: (0, jsx_runtime_1.jsx)(button_1.Button, { variant: "link", className: "text-muted-foreground", onClick: refreshIframe, children: (0, jsx_runtime_1.jsx)(lucide_react_1.RotateCw, { className: "h-4 w-4" }) }) }), (0, jsx_runtime_1.jsx)(tooltip_1.TooltipContent, { children: "Refresh" })] }) }), (0, jsx_runtime_1.jsx)("span", { className: "text-muted-foreground text-xs flex-1 text-ellipsis overflow-hidden whitespace-nowrap", children: result.url }), (0, jsx_runtime_1.jsx)(tooltip_1.TooltipProvider, { children: (0, jsx_runtime_1.jsxs)(tooltip_1.Tooltip, { delayDuration: 0, children: [(0, jsx_runtime_1.jsx)(tooltip_1.TooltipTrigger, { asChild: true, children: (0, jsx_runtime_1.jsx)(copy_button_1.CopyButton, { variant: "link", content: result.url, className: "text-muted-foreground" }) }), (0, jsx_runtime_1.jsx)(tooltip_1.TooltipContent, { children: "Copy URL" })] }) })] }) })] }));
}
//# sourceMappingURL=fragment-web.js.map