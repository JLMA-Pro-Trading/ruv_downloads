import { FragmentSchema } from '@/lib/schema';
import { ExecutionResult } from '@/lib/types';
import { DeepPartial } from 'ai';
import { Dispatch, SetStateAction } from 'react';
export declare function Preview({ apiKey, selectedTab, onSelectedTabChange, isChatLoading, isPreviewLoading, fragment, result, onClose, }: {
    apiKey: string | undefined;
    selectedTab: 'code' | 'fragment';
    onSelectedTabChange: Dispatch<SetStateAction<'code' | 'fragment'>>;
    isChatLoading: boolean;
    isPreviewLoading: boolean;
    fragment?: DeepPartial<FragmentSchema>;
    result?: ExecutionResult;
    onClose: () => void;
}): import("react/jsx-runtime").JSX.Element | null;
//# sourceMappingURL=preview.d.ts.map