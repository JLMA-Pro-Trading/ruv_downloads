import { LLMModel, LLMModelConfig } from '@/lib/models';
import { TemplateId, Templates } from '@/lib/templates';
import 'core-js/features/object/group-by.js';
export declare function ChatPicker({ templates, selectedTemplate, onSelectedTemplateChange, models, languageModel, onLanguageModelChange, }: {
    templates: Templates;
    selectedTemplate: 'auto' | TemplateId;
    onSelectedTemplateChange: (template: 'auto' | TemplateId) => void;
    models: LLMModel[];
    languageModel: LLMModelConfig;
    onLanguageModelChange: (config: LLMModelConfig) => void;
}): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=chat-picker.d.ts.map