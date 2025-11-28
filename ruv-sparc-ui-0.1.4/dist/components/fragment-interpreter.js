"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FragmentInterpreter = FragmentInterpreter;
var jsx_runtime_1 = require("react/jsx-runtime");
var alert_1 = require("@/components/ui/alert");
var lucide_react_1 = require("lucide-react");
var image_1 = __importDefault(require("next/image"));
function LogsOutput(_a) {
    var stdout = _a.stdout, stderr = _a.stderr;
    if (stdout.length === 0 && stderr.length === 0)
        return null;
    return ((0, jsx_runtime_1.jsxs)("div", { className: "w-full h-32 max-h-32 overflow-y-auto flex flex-col items-start justify-start space-y-1 p-4", children: [stdout &&
                stdout.length > 0 &&
                stdout.map(function (out, index) { return ((0, jsx_runtime_1.jsx)("pre", { className: "text-xs", children: out }, index)); }), stderr &&
                stderr.length > 0 &&
                stderr.map(function (err, index) { return ((0, jsx_runtime_1.jsx)("pre", { className: "text-xs text-red-500", children: err }, index)); })] }));
}
function FragmentInterpreter(_a) {
    var result = _a.result;
    var cellResults = result.cellResults, stdout = result.stdout, stderr = result.stderr, runtimeError = result.runtimeError;
    // The AI-generated code experienced runtime error
    if (runtimeError) {
        var name_1 = runtimeError.name, value = runtimeError.value, traceback = runtimeError.traceback;
        return ((0, jsx_runtime_1.jsx)("div", { className: "p-4", children: (0, jsx_runtime_1.jsxs)(alert_1.Alert, { variant: "destructive", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Terminal, { className: "h-4 w-4" }), (0, jsx_runtime_1.jsxs)(alert_1.AlertTitle, { children: [name_1, ": ", value] }), (0, jsx_runtime_1.jsx)(alert_1.AlertDescription, { className: "font-mono whitespace-pre-wrap", children: traceback })] }) }));
    }
    // Cell results can contain text, pdfs, images, and code (html, latex, json)
    // TODO: Show all results
    // TODO: Check other formats than `png`
    if (cellResults.length > 0) {
        var imgInBase64 = cellResults[0].png;
        return ((0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col h-full", children: [(0, jsx_runtime_1.jsx)("div", { className: "w-full flex-1 p-4 flex items-start justify-center border-b", children: (0, jsx_runtime_1.jsx)(image_1.default, { src: "data:image/png;base64,".concat(imgInBase64), alt: "result", width: 600, height: 400 }) }), (0, jsx_runtime_1.jsx)(LogsOutput, { stdout: stdout, stderr: stderr })] }));
    }
    // No cell results, but there is stdout or stderr
    if (stdout.length > 0 || stderr.length > 0) {
        return (0, jsx_runtime_1.jsx)(LogsOutput, { stdout: stdout, stderr: stderr });
    }
    return (0, jsx_runtime_1.jsx)("span", { children: "No output or logs" });
}
//# sourceMappingURL=fragment-interpreter.js.map