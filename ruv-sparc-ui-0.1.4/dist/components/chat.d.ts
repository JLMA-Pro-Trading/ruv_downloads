import { Message } from '@/lib/messages';
import { FragmentSchema } from '@/lib/schema';
import { ExecutionResult } from '@/lib/types';
import { DeepPartial } from 'ai';
export declare function Chat({ messages, isLoading, setCurrentPreview, }: {
    messages: Message[];
    isLoading: boolean;
    setCurrentPreview: (preview: {
        fragment: DeepPartial<FragmentSchema> | undefined;
        result: ExecutionResult | undefined;
    }) => void;
}): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=chat.d.ts.map