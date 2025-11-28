"use strict";
/**
 * Logger utilities with colored output
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const chalk_1 = __importDefault(require("chalk"));
const boxen_1 = __importDefault(require("boxen"));
const gradient_string_1 = __importDefault(require("gradient-string"));
const agenticsGradient = (0, gradient_string_1.default)(['#6366f1', '#8b5cf6', '#a855f7']);
exports.logger = {
    banner(text) {
        console.log(agenticsGradient(text));
    },
    info(message) {
        console.log(chalk_1.default.blue('ℹ'), message);
    },
    success(message) {
        console.log(chalk_1.default.green('✔'), message);
    },
    warning(message) {
        console.log(chalk_1.default.yellow('⚠'), message);
    },
    error(message) {
        console.log(chalk_1.default.red('✖'), message);
    },
    step(step, total, message) {
        console.log(chalk_1.default.cyan(`[${step}/${total}]`), message);
    },
    box(content, title) {
        console.log((0, boxen_1.default)(content, {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: 'magenta',
            title: title,
            titleAlignment: 'center'
        }));
    },
    divider() {
        console.log(chalk_1.default.gray('─'.repeat(60)));
    },
    newline() {
        console.log();
    },
    link(text, url) {
        console.log(chalk_1.default.cyan.underline(`${text}: ${url}`));
    },
    list(items) {
        items.forEach(item => {
            console.log(chalk_1.default.gray('  •'), item);
        });
    },
    table(data) {
        const maxKeyLength = Math.max(...Object.keys(data).map(k => k.length));
        Object.entries(data).forEach(([key, value]) => {
            console.log(chalk_1.default.gray('  '), chalk_1.default.white(key.padEnd(maxKeyLength)), chalk_1.default.gray(':'), chalk_1.default.cyan(value));
        });
    }
};
//# sourceMappingURL=logger.js.map