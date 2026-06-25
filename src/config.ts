import fs from 'fs/promises';
import path from 'path';
import type { SlimConfig, SlimOptions } from './types.js';

const CONFIG_FILENAME = '.contextslim.json';

export async function loadConfig(targetDir: string): Promise<SlimConfig> {
  const configPath = path.join(targetDir, CONFIG_FILENAME);
  try {
    const raw = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(raw) as SlimConfig;
  } catch {
    return {};
  }
}

export function mergeCliOptions(
  fileConfig: SlimConfig,
  cliOpts: Record<string, unknown>,
  targetDir: string,
): SlimOptions {
  return {
    targetDir,
    output: (cliOpts['output'] as string | undefined) ?? fileConfig.output ?? 'llm_context.md',
    maxDepth: cliOpts['maxDepth'] !== undefined
      ? parseInt(cliOpts['maxDepth'] as string, 10)
      : (fileConfig.maxDepth ?? 10),
    maxSizeKb: cliOpts['maxSize'] !== undefined
      ? parseInt(cliOpts['maxSize'] as string, 10)
      : (fileConfig.maxSizeKb ?? 500),
    tree: cliOpts['tree'] !== false,
    content: cliOpts['content'] !== false,
    include: [
      ...(fileConfig.include ?? []),
      ...((cliOpts['include'] as string[] | undefined) ?? []),
    ],
    ignore: [
      ...(fileConfig.ignore ?? []),
      ...((cliOpts['ignore'] as string[] | undefined) ?? []),
    ],
    stats: (cliOpts['stats'] as boolean | undefined) ?? fileConfig.stats ?? false,
  };
}
