import chalk from 'chalk';
export const ruvAsciiArt = `
${chalk.cyan(`
  █▀█ █░█ █░█ █
  █▀▄ █▄█ ▀▄▀ █
`)}
${chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}
${chalk.white.bold('  Agentic Engineering Console')}
${chalk.gray('  with MCP Tools & Resources')}
${chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}
`;
export const welcomeMessage = (username) => {
    if (username) {
        return chalk.green(`\n✓ Welcome back, ${chalk.bold(username)}!\n`);
    }
    return chalk.yellow(`\n⚠ Not logged in. Use ${chalk.bold('ruv login')} to authenticate.\n`);
};
export const spinner = {
    frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
    interval: 80,
};
//# sourceMappingURL=ascii-art.js.map