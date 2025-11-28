"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FragmentCode = FragmentCode;
var jsx_runtime_1 = require("react/jsx-runtime");
var code_view_1 = require("./code-view");
var button_1 = require("./ui/button");
var copy_button_1 = require("./ui/copy-button");
var tooltip_1 = require("@/components/ui/tooltip");
var lucide_react_1 = require("lucide-react");
var react_1 = require("react");
function FragmentCode(_a) {
    var _b;
    var files = _a.files;
    if (!files.length) {
        return ((0, jsx_runtime_1.jsx)("div", { className: "flex flex-col h-full items-center justify-center text-muted-foreground", children: "No files to display" }));
    }
    var _c = (0, react_1.useState)(files[0].name), currentFile = _c[0], setCurrentFile = _c[1];
    var currentFileContent = (_b = files.find(function (file) { return file.name === currentFile; })) === null || _b === void 0 ? void 0 : _b.content;
    function download(filename, content) {
        var blob = new Blob([content], { type: 'text/plain' });
        var url = window.URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }
    return ((0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col h-full", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center px-2 pt-1 gap-2", children: [(0, jsx_runtime_1.jsx)("div", { className: "flex flex-1 gap-2 overflow-x-auto", children: files.map(function (file) { return ((0, jsx_runtime_1.jsxs)("div", { className: "flex gap-2 select-none cursor-pointer items-center text-sm text-muted-foreground px-2 py-1 rounded-md hover:bg-muted border ".concat(file.name === currentFile ? 'bg-muted border-muted' : ''), onClick: function () { return setCurrentFile(file.name); }, children: [(0, jsx_runtime_1.jsx)(lucide_react_1.FileText, { className: "h-4 w-4" }), file.name] }, file.name)); }) }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)(tooltip_1.TooltipProvider, { children: (0, jsx_runtime_1.jsxs)(tooltip_1.Tooltip, { delayDuration: 0, children: [(0, jsx_runtime_1.jsx)(tooltip_1.TooltipTrigger, { asChild: true, children: (0, jsx_runtime_1.jsx)(copy_button_1.CopyButton, { content: currentFileContent || '', className: "text-muted-foreground" }) }), (0, jsx_runtime_1.jsx)(tooltip_1.TooltipContent, { side: "bottom", children: "Copy" })] }) }), (0, jsx_runtime_1.jsx)(tooltip_1.TooltipProvider, { children: (0, jsx_runtime_1.jsxs)(tooltip_1.Tooltip, { delayDuration: 0, children: [(0, jsx_runtime_1.jsx)(tooltip_1.TooltipTrigger, { asChild: true, children: (0, jsx_runtime_1.jsx)(button_1.Button, { variant: "ghost", size: "icon", className: "text-muted-foreground", onClick: function () {
                                                    return download(currentFile, currentFileContent || '');
                                                }, children: (0, jsx_runtime_1.jsx)(lucide_react_1.Download, { className: "h-4 w-4" }) }) }), (0, jsx_runtime_1.jsx)(tooltip_1.TooltipContent, { side: "bottom", children: "Download" })] }) })] })] }), (0, jsx_runtime_1.jsx)("div", { className: "flex flex-col flex-1 overflow-x-auto", children: (0, jsx_runtime_1.jsx)(code_view_1.CodeView, { code: currentFileContent || '', lang: currentFile.split('.').pop() || '' }) })] }));
}
//# sourceMappingURL=fragment-code.js.map