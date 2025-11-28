import templates from './templates.json';
export default templates;
export type Templates = typeof templates;
export type TemplateId = keyof typeof templates;
export type TemplateConfig = typeof templates[TemplateId];
export declare function templatesToPrompt(templates: Templates): string;
//# sourceMappingURL=templates.d.ts.map