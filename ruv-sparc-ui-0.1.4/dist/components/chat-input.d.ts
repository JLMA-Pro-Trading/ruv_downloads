import { SetStateAction } from 'react';
export declare function ChatInput({ retry, isErrored, isLoading, isRateLimited, stop, input, handleInputChange, handleSubmit, isMultiModal, files, handleFileChange, children, }: {
    retry: () => void;
    isErrored: boolean;
    isLoading: boolean;
    isRateLimited: boolean;
    stop: () => void;
    input: string;
    handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
    isMultiModal: boolean;
    files: File[];
    handleFileChange: (change: SetStateAction<File[]>) => void;
    children: React.ReactNode;
}): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=chat-input.d.ts.map