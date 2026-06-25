#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import { buildContext } from './context.js';
import { writeOutput } from './output.js';
import { loadConfig, mergeCliOptions } from './config.js';
import type { SlimOptions } from './types.js';

const program = new Command();

program
  .name('contextslim')
  .description('Generate a single, token-optimized Markdown context file for LLMs.')
  .version('0.1.0')
  .argument('[directory]', 'Target project directory', '.')
  .option('-o, --output <file>', 'Output file name', 'llm_context.md')
  .option('-d, --max-depth <number>', 'Maximum directory depth for the tree', '10')
  .option('-s, --max-size <kb>', 'Skip files larger than this size in KB', '500')
  .option('--no-tree', 'Omit the directory tree from output')
  .option('--no-content', 'Omit file contents from output (tree only)')
  .option('--include <globs...>', 'Additional glob patterns to include')
  .option('--ignore <globs...>', 'Additional glob patterns to ignore')
  .option('--stats', 'Print token and file statistics after generation')
  .action(async (directory: string, cliOpts: Record<string, unknown>) => {
    const targetDir = path.resolve(directory);
    const spinner = ora({ text: `Scanning ${chalk.cyan(targetDir)}`, color: 'cyan' }).start();

    try {
      const fileConfig = await loadConfig(targetDir);
      const options: SlimOptions = mergeCliOptions(fileConfig, cliOpts, targetDir);

      const { tree, files, stats } = await buildContext(options);
      spinner.succeed(`Scanned ${chalk.bold(stats.fileCount)} files`);

      const outputPath = path.resolve(options.output);
      await writeOutput({ tree, files, outputPath, options });

      console.log(chalk.green('✔') + ` Output → ${chalk.bold(outputPath)}`);

      if (options.stats) {
        console.log();
        console.log(chalk.dim('─'.repeat(40)));
        console.log(`  Files included : ${chalk.bold(stats.fileCount)}`);
        console.log(`  Files skipped  : ${chalk.bold(stats.skippedCount)}`);
        console.log(`  Chars written  : ${chalk.bold(stats.totalChars.toLocaleString())}`);
        console.log(`  Est. tokens    : ${chalk.bold(Math.ceil(stats.totalChars / 4).toLocaleString())}`);
        console.log(chalk.dim('─'.repeat(40)));
      }
    } catch (err) {
      spinner.fail('Failed');
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
  });

program.parse();
