"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeployDialog = DeployDialog;
var jsx_runtime_1 = require("react/jsx-runtime");
var logo_1 = __importDefault(require("./logo"));
var copy_button_1 = require("./ui/copy-button");
var select_1 = require("./ui/select");
var publish_1 = require("@/app/actions/publish");
var button_1 = require("@/components/ui/button");
var dropdown_menu_1 = require("@/components/ui/dropdown-menu");
var input_1 = require("@/components/ui/input");
var react_1 = require("posthog-js/react");
var react_2 = require("react");
function DeployDialog(_a) {
    var url = _a.url, sbxId = _a.sbxId, apiKey = _a.apiKey;
    var posthog = (0, react_1.usePostHog)();
    var _b = (0, react_2.useState)(null), publishedURL = _b[0], setPublishedURL = _b[1];
    var _c = (0, react_2.useState)(null), duration = _c[0], setDuration = _c[1];
    (0, react_2.useEffect)(function () {
        setPublishedURL(null);
    }, [url]);
    function publishURL(e) {
        return __awaiter(this, void 0, void 0, function () {
            var publishedURL;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        e.preventDefault();
                        return [4 /*yield*/, (0, publish_1.publish)(url, sbxId, duration, apiKey)];
                    case 1:
                        publishedURL = (_a.sent()).url;
                        setPublishedURL(publishedURL);
                        posthog.capture('publish_url', {
                            url: publishedURL,
                        });
                        return [2 /*return*/];
                }
            });
        });
    }
    return ((0, jsx_runtime_1.jsxs)(dropdown_menu_1.DropdownMenu, { children: [(0, jsx_runtime_1.jsx)(dropdown_menu_1.DropdownMenuTrigger, { asChild: true, children: (0, jsx_runtime_1.jsxs)(button_1.Button, { variant: "default", children: [(0, jsx_runtime_1.jsx)(logo_1.default, { style: "e2b", width: 16, height: 16, className: "mr-2" }), "Deploy to E2B"] }) }), (0, jsx_runtime_1.jsxs)(dropdown_menu_1.DropdownMenuContent, { className: "p-4 w-80 flex flex-col gap-2", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-sm font-semibold", children: "Deploy to E2B" }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-muted-foreground", children: "Deploying the fragment will make it publicly accessible to others via link." }), (0, jsx_runtime_1.jsxs)("div", { className: "text-sm text-muted-foreground", children: ["The fragment will be available up until the expiration date you choose and you'll be billed based on our", ' ', (0, jsx_runtime_1.jsx)("a", { href: "https://e2b.dev/docs/pricing", target: "_blank", className: "underline", children: "Compute pricing" }), "."] }), (0, jsx_runtime_1.jsxs)("div", { className: "text-sm text-muted-foreground", children: ["All new accounts receive $100 worth of compute credits. Upgrade to", ' ', (0, jsx_runtime_1.jsx)("a", { href: "https://e2b.dev/dashboard?tab=billing", target: "_blank", className: "underline", children: "Pro tier" }), ' ', "for longer expiration."] }), (0, jsx_runtime_1.jsxs)("form", { className: "flex flex-col gap-2", onSubmit: publishURL, children: [publishedURL ? ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)(input_1.Input, { value: publishedURL, readOnly: true }), (0, jsx_runtime_1.jsx)(copy_button_1.CopyButton, { content: publishedURL })] })) : ((0, jsx_runtime_1.jsxs)(select_1.Select, { onValueChange: function (value) { return setDuration(value); }, required: true, children: [(0, jsx_runtime_1.jsx)(select_1.SelectTrigger, { children: (0, jsx_runtime_1.jsx)(select_1.SelectValue, { placeholder: "Set expiration" }) }), (0, jsx_runtime_1.jsx)(select_1.SelectContent, { children: (0, jsx_runtime_1.jsxs)(select_1.SelectGroup, { children: [(0, jsx_runtime_1.jsx)(select_1.SelectLabel, { children: "Expires in" }), (0, jsx_runtime_1.jsx)(select_1.SelectItem, { value: "30m", children: "30 Minutes" }), (0, jsx_runtime_1.jsx)(select_1.SelectItem, { value: "1h", children: "1 Hour" }), (0, jsx_runtime_1.jsx)(select_1.SelectItem, { value: "3h", children: "3 Hours \u00B7 Pro" }), (0, jsx_runtime_1.jsx)(select_1.SelectItem, { value: "6h", children: "6 Hours \u00B7 Pro" }), (0, jsx_runtime_1.jsx)(select_1.SelectItem, { value: "1d", children: "1 Day \u00B7 Pro" })] }) })] })), (0, jsx_runtime_1.jsx)(button_1.Button, { type: "submit", variant: "default", disabled: publishedURL !== null, children: publishedURL ? 'Deployed' : 'Accept and deploy' })] })] })] }));
}
//# sourceMappingURL=deploy-dialog.js.map