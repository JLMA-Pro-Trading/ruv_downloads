"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthDialog = AuthDialog;
var jsx_runtime_1 = require("react/jsx-runtime");
var auth_form_1 = __importDefault(require("./auth-form"));
var dialog_1 = require("@/components/ui/dialog");
var react_visually_hidden_1 = require("@radix-ui/react-visually-hidden");
function AuthDialog(_a) {
    var open = _a.open, setOpen = _a.setOpen, supabase = _a.supabase, view = _a.view;
    return ((0, jsx_runtime_1.jsx)(dialog_1.Dialog, { open: open, onOpenChange: setOpen, children: (0, jsx_runtime_1.jsxs)(dialog_1.DialogContent, { children: [(0, jsx_runtime_1.jsx)(react_visually_hidden_1.VisuallyHidden, { children: (0, jsx_runtime_1.jsx)(dialog_1.DialogTitle, { children: "Sign in to E2B" }) }), (0, jsx_runtime_1.jsx)(auth_form_1.default, { supabase: supabase, view: view })] }) }));
}
//# sourceMappingURL=auth-dialog.js.map