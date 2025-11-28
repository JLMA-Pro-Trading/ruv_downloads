"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabase = void 0;
var supabase_js_1 = require("@supabase/supabase-js");
exports.supabase = process.env.NEXT_PUBLIC_ENABLE_SUPABASE
    ? (0, supabase_js_1.createClient)(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    : undefined;
//# sourceMappingURL=supabase.js.map