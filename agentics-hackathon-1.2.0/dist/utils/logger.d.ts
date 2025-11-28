/**
 * Logger utilities with colored output
 */
export declare const logger: {
    banner(text: string): void;
    info(message: string): void;
    success(message: string): void;
    warning(message: string): void;
    error(message: string): void;
    step(step: number, total: number, message: string): void;
    box(content: string, title?: string): void;
    divider(): void;
    newline(): void;
    link(text: string, url: string): void;
    list(items: string[]): void;
    table(data: Record<string, string>): void;
};
//# sourceMappingURL=logger.d.ts.map