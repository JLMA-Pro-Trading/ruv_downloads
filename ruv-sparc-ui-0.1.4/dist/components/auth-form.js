"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var jsx_runtime_1 = require("react/jsx-runtime");
var logo_1 = __importDefault(require("./logo"));
var auth_ui_react_1 = require("@supabase/auth-ui-react");
var auth_ui_shared_1 = require("@supabase/auth-ui-shared");
function AuthForm(_a) {
    var supabase = _a.supabase, _b = _a.view, view = _b === void 0 ? 'sign_in' : _b;
    return ((0, jsx_runtime_1.jsxs)("div", { className: "flex justify-center items-center flex-col", children: [(0, jsx_runtime_1.jsxs)("h1", { className: "flex items-center gap-4 text-xl font-bold mb-2 w-full", children: [(0, jsx_runtime_1.jsx)("div", { className: "flex items-center justify-center rounded-md shadow-md bg-black p-2", children: (0, jsx_runtime_1.jsx)(logo_1.default, { className: "text-white w-6 h-6" }) }), "Sign in to Fragments"] }), (0, jsx_runtime_1.jsx)("div", { className: "w-full", children: (0, jsx_runtime_1.jsx)(auth_ui_react_1.Auth, { supabaseClient: supabase, appearance: {
                        theme: auth_ui_shared_1.ThemeSupa,
                        variables: {
                            default: {
                                colors: {
                                    brand: 'rgb(255, 136, 0)',
                                    brandAccent: 'rgb(255, 136, 0)',
                                    inputText: 'hsl(var(--foreground))',
                                    dividerBackground: 'hsl(var(--border))',
                                    inputBorder: 'hsl(var(--input))',
                                    inputBorderFocus: 'hsl(var(--ring))',
                                    inputBorderHover: 'hsl(var(--input))',
                                    inputLabelText: 'hsl(var(--muted-foreground))',
                                    defaultButtonText: 'hsl(var(--primary))',
                                    defaultButtonBackground: 'hsl(var(--secondary))',
                                    defaultButtonBackgroundHover: 'hsl(var(--secondary))',
                                    defaultButtonBorder: 'hsl(var(--secondary))',
                                },
                                radii: {
                                    borderRadiusButton: '0.7rem',
                                    inputBorderRadius: '0.7rem',
                                },
                            },
                        },
                    }, localization: {
                        variables: {
                            sign_in: {
                                email_label: 'Email address',
                                password_label: 'Password',
                            },
                        },
                    }, view: view, theme: "default", showLinks: true, providers: ['github', 'google'], providerScopes: {
                        github: 'email',
                    } }) })] }));
}
exports.default = AuthForm;
//# sourceMappingURL=auth-form.js.map