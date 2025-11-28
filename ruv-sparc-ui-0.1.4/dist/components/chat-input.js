"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatInput = ChatInput;
var jsx_runtime_1 = require("react/jsx-runtime");
var button_1 = require("@/components/ui/button");
var tooltip_1 = require("@/components/ui/tooltip");
var lucide_react_1 = require("lucide-react");
var react_1 = require("react");
var react_textarea_autosize_1 = __importDefault(require("react-textarea-autosize"));
function ChatInput(_a) {
    var retry = _a.retry, isErrored = _a.isErrored, isLoading = _a.isLoading, isRateLimited = _a.isRateLimited, stop = _a.stop, input = _a.input, handleInputChange = _a.handleInputChange, handleSubmit = _a.handleSubmit, isMultiModal = _a.isMultiModal, files = _a.files, handleFileChange = _a.handleFileChange, children = _a.children;
    function handleFileInput(e) {
        handleFileChange(function (prev) { return __spreadArray(__spreadArray([], prev, true), Array.from(e.target.files || []), true); });
    }
    function handleFileRemove(file) {
        handleFileChange(function (prev) { return prev.filter(function (f) { return f !== file; }); });
    }
    var filePreview = (0, react_1.useMemo)(function () {
        if (files.length === 0)
            return null;
        return Array.from(files).map(function (file) {
            return ((0, jsx_runtime_1.jsxs)("div", { className: "relative", children: [(0, jsx_runtime_1.jsx)("span", { onClick: function () { return handleFileRemove(file); }, className: "absolute top-[-8] right-[-8] bg-muted rounded-full p-1", children: (0, jsx_runtime_1.jsx)(lucide_react_1.X, { className: "h-3 w-3 cursor-pointer" }) }), (0, jsx_runtime_1.jsx)("img", { src: URL.createObjectURL(file), alt: file.name, className: "rounded-xl w-10 h-10 object-cover" })] }, file.name));
        });
    }, [files]);
    function onEnter(e) {
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            if (e.currentTarget.checkValidity()) {
                handleSubmit(e);
            }
            else {
                e.currentTarget.reportValidity();
            }
        }
    }
    return ((0, jsx_runtime_1.jsxs)("form", { onSubmit: handleSubmit, onKeyDown: onEnter, className: "mb-2 flex flex-col mt-auto bg-background", children: [isErrored && ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center p-1.5 text-sm font-medium mb-2 rounded-xl ".concat(isRateLimited
                    ? 'bg-orange-400/10 text-orange-400'
                    : 'bg-red-400/10 text-red-400'), children: [(0, jsx_runtime_1.jsx)("span", { className: "flex-1 px-1.5", children: isRateLimited
                            ? 'You have reached your request limit for the day.'
                            : 'An unexpected error has occurred.' }), (0, jsx_runtime_1.jsx)("button", { className: "px-2 py-1 rounded-sm ".concat(isRateLimited ? 'bg-orange-400/20' : 'bg-red-400/20'), onClick: retry, children: "Try again" })] })), (0, jsx_runtime_1.jsxs)("div", { className: "shadow-md rounded-2xl border", children: [(0, jsx_runtime_1.jsx)("div", { className: "flex items-center px-3 py-2 gap-1", children: children }), (0, jsx_runtime_1.jsx)(react_textarea_autosize_1.default, { autoFocus: true, minRows: 1, maxRows: 5, className: "text-normal px-3 resize-none ring-0 bg-inherit w-full m-0 outline-none", required: true, placeholder: "Describe your app...", disabled: isErrored, value: input, onChange: handleInputChange }), (0, jsx_runtime_1.jsxs)("div", { className: "flex p-3 gap-2 items-center", children: [(0, jsx_runtime_1.jsx)("input", { type: "file", id: "multimodal", name: "multimodal", accept: "image/*", multiple: true, className: "hidden", onChange: handleFileInput }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center flex-1 gap-2", children: [(0, jsx_runtime_1.jsx)(tooltip_1.TooltipProvider, { children: (0, jsx_runtime_1.jsxs)(tooltip_1.Tooltip, { delayDuration: 0, children: [(0, jsx_runtime_1.jsx)(tooltip_1.TooltipTrigger, { asChild: true, children: (0, jsx_runtime_1.jsx)(button_1.Button, { disabled: !isMultiModal || isErrored, type: "button", variant: "outline", size: "icon", className: "rounded-xl h-10 w-10", onClick: function (e) {
                                                            var _a;
                                                            e.preventDefault();
                                                            (_a = document.getElementById('multimodal')) === null || _a === void 0 ? void 0 : _a.click();
                                                        }, children: (0, jsx_runtime_1.jsx)(lucide_react_1.Paperclip, { className: "h-5 w-5" }) }) }), (0, jsx_runtime_1.jsx)(tooltip_1.TooltipContent, { children: "Add attachments" })] }) }), files.length > 0 && filePreview] }), (0, jsx_runtime_1.jsx)("div", { children: !isLoading ? ((0, jsx_runtime_1.jsx)(tooltip_1.TooltipProvider, { children: (0, jsx_runtime_1.jsxs)(tooltip_1.Tooltip, { delayDuration: 0, children: [(0, jsx_runtime_1.jsx)(tooltip_1.TooltipTrigger, { asChild: true, children: (0, jsx_runtime_1.jsx)(button_1.Button, { disabled: isErrored, variant: "default", size: "icon", type: "submit", className: "rounded-xl h-10 w-10", children: (0, jsx_runtime_1.jsx)(lucide_react_1.ArrowUp, { className: "h-5 w-5" }) }) }), (0, jsx_runtime_1.jsx)(tooltip_1.TooltipContent, { children: "Send message" })] }) })) : ((0, jsx_runtime_1.jsx)(tooltip_1.TooltipProvider, { children: (0, jsx_runtime_1.jsxs)(tooltip_1.Tooltip, { delayDuration: 0, children: [(0, jsx_runtime_1.jsx)(tooltip_1.TooltipTrigger, { asChild: true, children: (0, jsx_runtime_1.jsx)(button_1.Button, { variant: "secondary", size: "icon", className: "rounded-xl h-10 w-10", onClick: function (e) {
                                                        e.preventDefault();
                                                        stop();
                                                    }, children: (0, jsx_runtime_1.jsx)(lucide_react_1.Square, { className: "h-5 w-5" }) }) }), (0, jsx_runtime_1.jsx)(tooltip_1.TooltipContent, { children: "Stop generation" })] }) })) })] })] }), (0, jsx_runtime_1.jsxs)("p", { className: "text-xs text-muted-foreground mt-2 text-center", children: ["Fragments by", ' ', (0, jsx_runtime_1.jsx)("a", { href: "https://e2b.dev", target: "_blank", className: "text-[#ff8800]", children: "\u2736 E2B" }), ' ', "and", ' ', (0, jsx_runtime_1.jsx)("a", { href: "https://github.com/ruvnet/sparc", target: "_blank", className: "text-[#ff8800]", children: "SPARC" }), " by rUv"] })] }));
}
//# sourceMappingURL=chat-input.js.map