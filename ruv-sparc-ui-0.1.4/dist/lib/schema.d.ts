import { z } from 'zod';
export declare const fragmentSchema: z.ZodObject<{
    commentary: z.ZodString;
    template: z.ZodString;
    title: z.ZodString;
    description: z.ZodString;
    additional_dependencies: z.ZodArray<z.ZodString, "many">;
    has_additional_dependencies: z.ZodBoolean;
    install_dependencies_command: z.ZodString;
    port: z.ZodNullable<z.ZodNumber>;
    code: z.ZodArray<z.ZodObject<{
        file_name: z.ZodString;
        file_path: z.ZodString;
        file_content: z.ZodString;
        file_finished: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        file_name: string;
        file_path: string;
        file_content: string;
        file_finished: boolean;
    }, {
        file_name: string;
        file_path: string;
        file_content: string;
        file_finished: boolean;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    title: string;
    code: {
        file_name: string;
        file_path: string;
        file_content: string;
        file_finished: boolean;
    }[];
    template: string;
    description: string;
    commentary: string;
    additional_dependencies: string[];
    has_additional_dependencies: boolean;
    install_dependencies_command: string;
    port: number | null;
}, {
    title: string;
    code: {
        file_name: string;
        file_path: string;
        file_content: string;
        file_finished: boolean;
    }[];
    template: string;
    description: string;
    commentary: string;
    additional_dependencies: string[];
    has_additional_dependencies: boolean;
    install_dependencies_command: string;
    port: number | null;
}>;
export type FragmentSchema = z.infer<typeof fragmentSchema>;
//# sourceMappingURL=schema.d.ts.map