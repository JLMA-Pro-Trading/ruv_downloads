"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Preview = Preview;
var jsx_runtime_1 = require("react/jsx-runtime");
var fragment_code_1 = require("./fragment-code");
var fragment_preview_1 = require("./fragment-preview");
var deploy_dialog_1 = require("./deploy-dialog");
var button_1 = require("@/components/ui/button");
var tabs_1 = require("@/components/ui/tabs");
var tooltip_1 = require("@/components/ui/tooltip");
var lucide_react_1 = require("lucide-react");
function Preview(_a) {
    var apiKey = _a.apiKey, selectedTab = _a.selectedTab, onSelectedTabChange = _a.onSelectedTabChange, isChatLoading = _a.isChatLoading, isPreviewLoading = _a.isPreviewLoading, fragment = _a.fragment, result = _a.result, onClose = _a.onClose;
    if (!fragment) {
        return null;
    }
    var isLinkAvailable = (result === null || result === void 0 ? void 0 : result.template) !== 'code-interpreter-v1';
    return ((0, jsx_runtime_1.jsx)("div", { className: "absolute md:relative top-0 left-0 shadow-2xl md:rounded-tl-3xl md:rounded-bl-3xl md:border-l md:border-y bg-popover h-full w-full overflow-auto", children: (0, jsx_runtime_1.jsxs)(tabs_1.Tabs, { value: selectedTab, onValueChange: function (value) {
                return onSelectedTabChange(value);
            }, className: "h-full flex flex-col items-start justify-start", children: [(0, jsx_runtime_1.jsxs)("div", { className: "w-full p-2 grid grid-cols-3 items-center border-b", children: [(0, jsx_runtime_1.jsx)(tooltip_1.TooltipProvider, { children: (0, jsx_runtime_1.jsxs)(tooltip_1.Tooltip, { delayDuration: 0, children: [(0, jsx_runtime_1.jsx)(tooltip_1.TooltipTrigger, { asChild: true, children: (0, jsx_runtime_1.jsx)(button_1.Button, { variant: "ghost", size: "icon", className: "text-muted-foreground", onClick: onClose, children: (0, jsx_runtime_1.jsx)(lucide_react_1.ChevronsRight, { className: "h-5 w-5" }) }) }), (0, jsx_runtime_1.jsx)(tooltip_1.TooltipContent, { children: "Close sidebar" })] }) }), (0, jsx_runtime_1.jsx)("div", { className: "flex justify-center", children: (0, jsx_runtime_1.jsxs)(tabs_1.TabsList, { className: "px-1 py-0 border h-8", children: [(0, jsx_runtime_1.jsxs)(tabs_1.TabsTrigger, { className: "font-normal text-xs py-1 px-2 gap-1 flex items-center", value: "code", children: [isChatLoading && ((0, jsx_runtime_1.jsx)(lucide_react_1.LoaderCircle, { strokeWidth: 3, className: "h-3 w-3 animate-spin" })), "Code"] }), (0, jsx_runtime_1.jsxs)(tabs_1.TabsTrigger, { disabled: !result, className: "font-normal text-xs py-1 px-2 gap-1 flex items-center", value: "fragment", children: ["Preview", isPreviewLoading && ((0, jsx_runtime_1.jsx)(lucide_react_1.LoaderCircle, { strokeWidth: 3, className: "h-3 w-3 animate-spin" }))] })] }) }), result && ((0, jsx_runtime_1.jsx)("div", { className: "flex items-center justify-end gap-2", children: isLinkAvailable && ((0, jsx_runtime_1.jsx)(deploy_dialog_1.DeployDialog, { url: result.url, sbxId: result.sbxId, apiKey: apiKey })) }))] }), fragment && ((0, jsx_runtime_1.jsxs)("div", { className: "overflow-y-auto w-full h-full", children: [(0, jsx_runtime_1.jsx)(tabs_1.TabsContent, { value: "code", className: "h-full", children: fragment.code && Array.isArray(fragment.code) && ((0, jsx_runtime_1.jsx)(fragment_code_1.FragmentCode, { files: fragment.code
                                    .filter(function (file) {
                                    return file !== null &&
                                        typeof file === 'object' &&
                                        typeof file.file_path === 'string' &&
                                        typeof file.file_content === 'string';
                                })
                                    .map(function (file) { return ({
                                    name: file.file_path,
                                    content: file.file_content,
                                }); }) })) }), (0, jsx_runtime_1.jsx)(tabs_1.TabsContent, { value: "fragment", className: "h-full", children: result && (0, jsx_runtime_1.jsx)(fragment_preview_1.FragmentPreview, { result: result }) })] }))] }) }));
}
//# sourceMappingURL=preview.js.map