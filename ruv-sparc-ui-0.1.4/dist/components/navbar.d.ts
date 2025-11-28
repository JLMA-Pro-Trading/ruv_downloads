import { Session } from '@supabase/supabase-js';
export declare function NavBar({ session, showLogin, signOut, onClear, canClear, onSocialClick, onUndo, canUndo, }: {
    session: Session | null;
    showLogin: () => void;
    signOut: () => void;
    onClear: () => void;
    canClear: boolean;
    onSocialClick: (target: 'github' | 'x' | 'discord') => void;
    onUndo: () => void;
    canUndo: boolean;
}): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=navbar.d.ts.map