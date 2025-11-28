import chalk from 'chalk';
export function printSuccess(message) {
    console.log(chalk.green(`✓ ${message}`));
}
export function printError(message) {
    console.log(chalk.red(`✗ ${message}`));
}
export function printWarning(message) {
    console.log(chalk.yellow(`⚠ ${message}`));
}
export function printInfo(message) {
    console.log(chalk.blue(`ℹ ${message}`));
}
export function printDivider() {
    console.log(chalk.gray('━'.repeat(50)));
}
export function printSection(title) {
    console.log();
    console.log(chalk.bold.white(title));
    printDivider();
}
export function printBox(content, title) {
    const lines = content.split('\n');
    const maxLength = Math.max(...lines.map(l => l.length), title?.length || 0);
    const border = '─'.repeat(maxLength + 2);
    console.log();
    if (title) {
        console.log(chalk.cyan(`┌─${title}─${border.slice(title.length)}┐`));
    }
    else {
        console.log(chalk.cyan(`┌${border}┐`));
    }
    lines.forEach(line => {
        const padding = ' '.repeat(maxLength - line.length);
        console.log(chalk.cyan('│') + ` ${line}${padding} ` + chalk.cyan('│'));
    });
    console.log(chalk.cyan(`└${border}┘`));
}
export function formatTable(headers, rows) {
    const columnWidths = headers.map((header, i) => {
        const maxRowWidth = Math.max(...rows.map(row => row[i]?.length || 0));
        return Math.max(header.length, maxRowWidth);
    });
    const headerRow = headers
        .map((header, i) => header.padEnd(columnWidths[i]))
        .join(' │ ');
    const separator = columnWidths
        .map(width => '─'.repeat(width))
        .join('─┼─');
    const dataRows = rows
        .map(row => row.map((cell, i) => cell.padEnd(columnWidths[i])).join(' │ '))
        .join('\n');
    return `${chalk.bold(headerRow)}\n${chalk.gray(separator)}\n${dataRows}`;
}
//# sourceMappingURL=ui.js.map