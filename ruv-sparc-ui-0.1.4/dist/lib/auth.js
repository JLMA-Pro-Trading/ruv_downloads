"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserAPIKey = getUserAPIKey;
exports.useAuth = useAuth;
var supabase_1 = require("./supabase");
var react_1 = require("posthog-js/react");
var react_2 = require("react");
function getUserAPIKey(session) {
    return __awaiter(this, void 0, void 0, function () {
        var userTeams, teams, defaultTeam;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // If Supabase is not initialized will use E2B_API_KEY env var
                    if (!supabase_1.supabase || process.env.E2B_API_KEY)
                        return [2 /*return*/, process.env.E2B_API_KEY];
                    return [4 /*yield*/, supabase_1.supabase
                            .from('users_teams')
                            .select('teams (id, name, is_default, tier, email, team_api_keys (api_key))')
                            .eq('user_id', session === null || session === void 0 ? void 0 : session.user.id)];
                case 1:
                    userTeams = (_a.sent()).data;
                    teams = userTeams === null || userTeams === void 0 ? void 0 : userTeams.map(function (userTeam) { return userTeam.teams; }).map(function (team) {
                        return __assign(__assign({}, team), { apiKeys: team.team_api_keys.map(function (apiKey) { return apiKey.api_key; }) });
                    });
                    defaultTeam = teams === null || teams === void 0 ? void 0 : teams.find(function (team) { return team.is_default; });
                    return [2 /*return*/, defaultTeam === null || defaultTeam === void 0 ? void 0 : defaultTeam.apiKeys[0]];
            }
        });
    });
}
function useAuth(setAuthDialog, setAuthView) {
    var _a = (0, react_2.useState)(null), session = _a[0], setSession = _a[1];
    var _b = (0, react_2.useState)(undefined), apiKey = _b[0], setApiKey = _b[1];
    var posthog = (0, react_1.usePostHog)();
    var recovery = false;
    (0, react_2.useEffect)(function () {
        if (!supabase_1.supabase) {
            console.warn('Supabase is not initialized');
            return setSession({ user: { email: 'demo@e2b.dev' } });
        }
        supabase_1.supabase.auth.getSession().then(function (_a) {
            var session = _a.data.session;
            setSession(session);
            if (session) {
                getUserAPIKey(session).then(setApiKey);
                if (!session.user.user_metadata.is_fragments_user) {
                    supabase_1.supabase === null || supabase_1.supabase === void 0 ? void 0 : supabase_1.supabase.auth.updateUser({
                        data: { is_fragments_user: true },
                    });
                }
                posthog.identify(session === null || session === void 0 ? void 0 : session.user.id, {
                    email: session === null || session === void 0 ? void 0 : session.user.email,
                    supabase_id: session === null || session === void 0 ? void 0 : session.user.id,
                });
                posthog.capture('sign_in');
            }
        });
        var subscription = supabase_1.supabase.auth.onAuthStateChange(function (_event, session) {
            setSession(session);
            if (_event === 'PASSWORD_RECOVERY') {
                recovery = true;
                setAuthView('update_password');
                setAuthDialog(true);
            }
            if (_event === 'USER_UPDATED' && recovery) {
                recovery = false;
            }
            if (_event === 'SIGNED_IN' && !recovery) {
                setAuthDialog(false);
                getUserAPIKey(session).then(setApiKey);
                if (!(session === null || session === void 0 ? void 0 : session.user.user_metadata.is_fragments_user)) {
                    supabase_1.supabase === null || supabase_1.supabase === void 0 ? void 0 : supabase_1.supabase.auth.updateUser({
                        data: { is_fragments_user: true },
                    });
                }
                posthog.identify(session === null || session === void 0 ? void 0 : session.user.id, {
                    email: session === null || session === void 0 ? void 0 : session.user.email,
                    supabase_id: session === null || session === void 0 ? void 0 : session.user.id,
                });
                posthog.capture('sign_in');
            }
            if (_event === 'SIGNED_OUT') {
                setApiKey(undefined);
                setAuthView('sign_in');
                posthog.capture('sign_out');
                posthog.reset();
            }
        }).data.subscription;
        return function () { return subscription.unsubscribe(); };
    }, []);
    return {
        session: session,
        apiKey: apiKey,
    };
}
//# sourceMappingURL=auth.js.map