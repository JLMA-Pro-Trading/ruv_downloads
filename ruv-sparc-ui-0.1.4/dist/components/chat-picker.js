"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatPicker = ChatPicker;
var jsx_runtime_1 = require("react/jsx-runtime");
var select_1 = require("@/components/ui/select");
require("core-js/features/object/group-by.js");
var lucide_react_1 = require("lucide-react");
var image_1 = __importDefault(require("next/image"));
function ChatPicker(_a) {
    var templates = _a.templates, selectedTemplate = _a.selectedTemplate, onSelectedTemplateChange = _a.onSelectedTemplateChange, models = _a.models, languageModel = _a.languageModel, onLanguageModelChange = _a.onLanguageModelChange;
    return ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)("div", { className: "flex flex-col", children: (0, jsx_runtime_1.jsxs)(select_1.Select, { name: "template", defaultValue: selectedTemplate, onValueChange: onSelectedTemplateChange, children: [(0, jsx_runtime_1.jsx)(select_1.SelectTrigger, { className: "whitespace-nowrap border-none shadow-none focus:ring-0 px-0 py-0 h-6 text-xs", children: (0, jsx_runtime_1.jsx)(select_1.SelectValue, { placeholder: "Select a persona" }) }), (0, jsx_runtime_1.jsx)(select_1.SelectContent, { side: "top", children: (0, jsx_runtime_1.jsxs)(select_1.SelectGroup, { children: [(0, jsx_runtime_1.jsx)(select_1.SelectLabel, { children: "Persona" }), (0, jsx_runtime_1.jsx)(select_1.SelectItem, { value: "auto", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Sparkles, { className: "flex text-[#a1a1aa]", width: 14, height: 14 }), (0, jsx_runtime_1.jsx)("span", { children: "Auto" })] }) }), Object.entries(templates).map(function (_a) {
                                        var templateId = _a[0], template = _a[1];
                                        return ((0, jsx_runtime_1.jsx)(select_1.SelectItem, { value: templateId, children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)(image_1.default, { className: "flex", src: "/thirdparty/templates/".concat(templateId, ".svg"), alt: templateId, width: 14, height: 14 }), (0, jsx_runtime_1.jsx)("span", { children: template.name })] }) }, templateId));
                                    })] }) })] }) }), (0, jsx_runtime_1.jsx)("div", { className: "flex flex-col", children: (0, jsx_runtime_1.jsxs)(select_1.Select, { name: "languageModel", defaultValue: languageModel.model, onValueChange: function (e) { return onLanguageModelChange({ model: e }); }, children: [(0, jsx_runtime_1.jsx)(select_1.SelectTrigger, { className: "whitespace-nowrap border-none shadow-none focus:ring-0 px-0 py-0 h-6 text-xs", children: (0, jsx_runtime_1.jsx)(select_1.SelectValue, { placeholder: "Language model" }) }), (0, jsx_runtime_1.jsx)(select_1.SelectContent, { children: Object.entries(Object.groupBy(models, function (_a) {
                                var provider = _a.provider;
                                return provider;
                            })).map(function (_a) {
                                var provider = _a[0], models = _a[1];
                                return ((0, jsx_runtime_1.jsxs)(select_1.SelectGroup, { children: [(0, jsx_runtime_1.jsx)(select_1.SelectLabel, { children: provider }), models === null || models === void 0 ? void 0 : models.map(function (model) { return ((0, jsx_runtime_1.jsx)(select_1.SelectItem, { value: model.id, children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center space-x-2", children: [(0, jsx_runtime_1.jsx)(image_1.default, { className: "flex", src: "/thirdparty/logos/".concat(model.providerId, ".svg"), alt: model.provider, width: 14, height: 14 }), (0, jsx_runtime_1.jsx)("span", { children: model.name })] }) }, model.id)); })] }, provider));
                            }) })] }) })] }));
}
//# sourceMappingURL=chat-picker.js.map