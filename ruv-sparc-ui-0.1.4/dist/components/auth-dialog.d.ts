import { AuthViewType } from '@/lib/auth';
import { SupabaseClient } from '@supabase/supabase-js';
export declare function AuthDialog({ open, setOpen, supabase, view, }: {
    open: boolean;
    setOpen: (open: boolean) => void;
    supabase: SupabaseClient;
    view: AuthViewType;
}): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=auth-dialog.d.ts.map