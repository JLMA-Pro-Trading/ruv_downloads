import { FragmentSchema } from './schema';
import { ExecutionResult } from './types';
import { DeepPartial } from 'ai';
export type MessageText = {
    type: 'text';
    text: string;
};
export type MessageCode = {
    type: 'code';
    text: string;
};
export type MessageImage = {
    type: 'image';
    image: string;
};
export type Message = {
    role: 'assistant' | 'user';
    content: Array<MessageText | MessageCode | MessageImage>;
    object?: DeepPartial<FragmentSchema>;
    result?: ExecutionResult;
};
export declare function toAISDKMessages(messages: Message[]): {
    role: "user" | "assistant";
    content: (MessageImage | {
        type: string;
        text: string;
    })[];
}[];
export declare function toMessageImage(files: File[]): Promise<string[]>;
//# sourceMappingURL=messages.d.ts.map