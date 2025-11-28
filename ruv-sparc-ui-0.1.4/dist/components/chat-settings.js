"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatSettings = ChatSettings;
var jsx_runtime_1 = require("react/jsx-runtime");
var button_1 = require("./ui/button");
var dropdown_menu_1 = require("./ui/dropdown-menu");
var input_1 = require("./ui/input");
var label_1 = require("./ui/label");
var tooltip_1 = require("./ui/tooltip");
var lucide_react_1 = require("lucide-react");
function ChatSettings(_a) {
    var apiKeyConfigurable = _a.apiKeyConfigurable, baseURLConfigurable = _a.baseURLConfigurable, languageModel = _a.languageModel, onLanguageModelChange = _a.onLanguageModelChange;
    return ((0, jsx_runtime_1.jsxs)(dropdown_menu_1.DropdownMenu, { children: [(0, jsx_runtime_1.jsx)(tooltip_1.TooltipProvider, { children: (0, jsx_runtime_1.jsxs)(tooltip_1.Tooltip, { delayDuration: 0, children: [(0, jsx_runtime_1.jsx)(tooltip_1.TooltipTrigger, { asChild: true, children: (0, jsx_runtime_1.jsx)(dropdown_menu_1.DropdownMenuTrigger, { asChild: true, children: (0, jsx_runtime_1.jsx)(button_1.Button, { variant: "ghost", size: "icon", className: "text-muted-foreground h-6 w-6 rounded-sm", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Settings2, { className: "h-4 w-4" }) }) }) }), (0, jsx_runtime_1.jsx)(tooltip_1.TooltipContent, { children: "LLM settings" })] }) }), (0, jsx_runtime_1.jsxs)(dropdown_menu_1.DropdownMenuContent, { align: "start", children: [apiKeyConfigurable && ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-2 px-2 py-2", children: [(0, jsx_runtime_1.jsx)(label_1.Label, { htmlFor: "apiKey", children: "API Key" }), (0, jsx_runtime_1.jsx)(input_1.Input, { name: "apiKey", type: "password", placeholder: "Auto", required: true, defaultValue: languageModel.apiKey, onChange: function (e) {
                                            return onLanguageModelChange({
                                                apiKey: e.target.value.length > 0 ? e.target.value : undefined,
                                            });
                                        }, className: "text-sm" })] }), (0, jsx_runtime_1.jsx)(dropdown_menu_1.DropdownMenuSeparator, {})] })), baseURLConfigurable && ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-2 px-2 py-2", children: [(0, jsx_runtime_1.jsx)(label_1.Label, { htmlFor: "baseURL", children: "Base URL" }), (0, jsx_runtime_1.jsx)(input_1.Input, { name: "baseURL", type: "text", placeholder: "Auto", required: true, defaultValue: languageModel.baseURL, onChange: function (e) {
                                            return onLanguageModelChange({
                                                baseURL: e.target.value.length > 0 ? e.target.value : undefined,
                                            });
                                        }, className: "text-sm" })] }), (0, jsx_runtime_1.jsx)(dropdown_menu_1.DropdownMenuSeparator, {})] })), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-1.5 px-2 py-2", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm font-medium", children: "Parameters" }), (0, jsx_runtime_1.jsxs)("div", { className: "flex space-x-4 items-center", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm flex-1 text-muted-foreground", children: "Output tokens" }), (0, jsx_runtime_1.jsx)(input_1.Input, { type: "number", defaultValue: languageModel.maxTokens, min: 50, max: 10000, step: 1, className: "h-6 rounded-sm w-[84px] text-xs text-center tabular-nums", placeholder: "Auto", onChange: function (e) {
                                            return onLanguageModelChange({
                                                maxTokens: parseFloat(e.target.value) || undefined,
                                            });
                                        } })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex space-x-4 items-center", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm flex-1 text-muted-foreground", children: "Temperature" }), (0, jsx_runtime_1.jsx)(input_1.Input, { type: "number", defaultValue: languageModel.temperature, min: 0, max: 5, step: 0.01, className: "h-6 rounded-sm w-[84px] text-xs text-center tabular-nums", placeholder: "Auto", onChange: function (e) {
                                            return onLanguageModelChange({
                                                temperature: parseFloat(e.target.value) || undefined,
                                            });
                                        } })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex space-x-4 items-center", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm flex-1 text-muted-foreground", children: "Top P" }), (0, jsx_runtime_1.jsx)(input_1.Input, { type: "number", defaultValue: languageModel.topP, min: 0, max: 1, step: 0.01, className: "h-6 rounded-sm w-[84px] text-xs text-center tabular-nums", placeholder: "Auto", onChange: function (e) {
                                            return onLanguageModelChange({
                                                topP: parseFloat(e.target.value) || undefined,
                                            });
                                        } })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex space-x-4 items-center", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm flex-1 text-muted-foreground", children: "Top K" }), (0, jsx_runtime_1.jsx)(input_1.Input, { type: "number", defaultValue: languageModel.topK, min: 0, max: 500, step: 1, className: "h-6 rounded-sm w-[84px] text-xs text-center tabular-nums", placeholder: "Auto", onChange: function (e) {
                                            return onLanguageModelChange({
                                                topK: parseFloat(e.target.value) || undefined,
                                            });
                                        } })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex space-x-4 items-center", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm flex-1 text-muted-foreground", children: "Frequence penalty" }), (0, jsx_runtime_1.jsx)(input_1.Input, { type: "number", defaultValue: languageModel.frequencyPenalty, min: 0, max: 2, step: 0.01, className: "h-6 rounded-sm w-[84px] text-xs text-center tabular-nums", placeholder: "Auto", onChange: function (e) {
                                            return onLanguageModelChange({
                                                frequencyPenalty: parseFloat(e.target.value) || undefined,
                                            });
                                        } })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex space-x-4 items-center", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm flex-1 text-muted-foreground", children: "Presence penalty" }), (0, jsx_runtime_1.jsx)(input_1.Input, { type: "number", defaultValue: languageModel.presencePenalty, min: 0, max: 2, step: 0.01, className: "h-6 rounded-sm w-[84px] text-xs text-center tabular-nums", placeholder: "Auto", onChange: function (e) {
                                            return onLanguageModelChange({
                                                presencePenalty: parseFloat(e.target.value) || undefined,
                                            });
                                        } })] })] })] })] }));
}
//# sourceMappingURL=chat-settings.js.map