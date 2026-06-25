import fs from 'fs/promises';
import path from 'path';
import * as ignoreModule from 'ignore';
import type { Ignore } from 'ignore';
import { DEFAULT_IGNORE_PATTERNS, LANGUAGE_MAP } from './constants.js';
import type { SlimOptions, ContextResult, FileEntry } from './types.js';

const ignore = (ignoreModule.default ?? ignoreModule) as unknown as () => Ignore;

export async function buildContext(options: SlimOptions): Promise<ContextResult> {
  const ig = buildIgnoreFilter(options);
  const collectedFiles: FileEntry[] = [];
  let skippedCount = 0;

  const treeLines: string[] = [];
  if (options.tree) {
    await walkTree(options.targetDir, options.targetDir, ig, options, treeLines, '');
  }

  if (options.content) {
    await collectFiles(options.targetDir, options.targetDir, ig, options, collectedFiles, (skipped) => {
      skippedCount += skipped;
    });
  }

  const totalChars = collectedFiles.reduce((sum, f) => sum + f.content.length, 0);

  return {
    tree: treeLines.join('\n'),
    files: collectedFiles,
    stats: {
      fileCount: collectedFiles.length,
      skippedCount,
      totalChars,
    },
  };
}

function buildIgnoreFilter(options: SlimOptions): Ignore {
  const ig = ignore();
  ig.add(DEFAULT_IGNORE_PATTERNS);
  ig.add(options.output);
  if (options.ignore.length > 0) ig.add(options.ignore);
  return ig;
}

async function walkTree(
  rootDir: string,
  currentDir: string,
  ig: Ignore,
  options: SlimOptions,
  lines: string[],
  prefix: string,
): Promise<void> {
  const depth = path.relative(rootDir, currentDir).split(path.sep).filter(Boolean).length;
  if (depth >= options.maxDepth) return;

  const entries = await fs.readdir(currentDir, { withFileTypes: true });
  const visible = entries
    .filter((e) => !ig.ignores(toRelative(rootDir, path.join(currentDir, e.name), e.isDirectory())))
    .sort((a: import('fs').Dirent, b: import('fs').Dirent) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  for (let i = 0; i < visible.length; i++) {
    const entry = visible[i];
    const isLast = i === visible.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const childPrefix = isLast ? '    ' : '│   ';

    lines.push(`${prefix}${connector}${entry.name}`);

    if (entry.isDirectory()) {
      await walkTree(
        rootDir,
        path.join(currentDir, entry.name),
        ig,
        options,
        lines,
        prefix + childPrefix,
      );
    }
  }
}

async function collectFiles(
  rootDir: string,
  currentDir: string,
  ig: Ignore,
  options: SlimOptions,
  results: FileEntry[],
  onSkip: (count: number) => void,
): Promise<void> {
  const depth = path.relative(rootDir, currentDir).split(path.sep).filter(Boolean).length;
  if (depth >= options.maxDepth) return;

  const entries = await fs.readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name);
    const relativePath = path.relative(rootDir, absolutePath);
    const relativeKey = toRelative(rootDir, absolutePath, entry.isDirectory());

    if (ig.ignores(relativeKey)) continue;

    if (entry.isDirectory()) {
      await collectFiles(rootDir, absolutePath, ig, options, results, onSkip);
      continue;
    }

    if (!entry.isFile()) continue;

    const stat = await fs.stat(absolutePath);
    if (stat.size / 1024 > options.maxSizeKb) {
      onSkip(1);
      continue;
    }

    const ext = path.extname(entry.name).slice(1).toLowerCase();
    const basename = entry.name.toLowerCase();

    if (isBinaryExtension(ext)) {
      onSkip(1);
      continue;
    }

    try {
      const raw = await fs.readFile(absolutePath, 'utf-8');
      const content = compressWhitespace(raw);
      const language = resolveLanguage(ext, basename);

      results.push({ relativePath: relativePath.replace(/\\/g, '/'), absolutePath, language, content });
    } catch {
      onSkip(1);
    }
  }
}

function toRelative(rootDir: string, absolutePath: string, isDir: boolean): string {
  let rel = path.relative(rootDir, absolutePath).replace(/\\/g, '/');
  if (isDir) rel += '/';
  return rel;
}

function compressWhitespace(source: string): string {
  return source
    .split('\n')
    .map((line) => line.trimEnd())
    .reduce((acc: string[], line, _i, arr) => {
      const prev = acc[acc.length - 1];
      if (line === '' && (prev === '' || prev === undefined)) return acc;
      acc.push(line);
      return acc;
    }, [])
    .join('\n')
    .trim();
}

function resolveLanguage(ext: string, basename: string): string {
  if (basename === 'dockerfile') return 'dockerfile';
  if (basename === 'makefile') return 'makefile';
  if (basename === 'gemfile') return 'ruby';
  if (basename === '.gitignore' || basename === '.npmignore') return 'gitignore';
  if (basename === '.env.example') return 'bash';
  return LANGUAGE_MAP[ext] ?? ext;
}

const BINARY_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'bmp', 'tiff',
  'mp4', 'mov', 'avi', 'mkv', 'webm', 'mp3', 'wav', 'ogg', 'flac',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'zip', 'tar', 'gz', 'rar', '7z', 'bz2',
  'exe', 'dll', 'so', 'dylib', 'wasm',
  'ttf', 'woff', 'woff2', 'eot',
  'sqlite', 'db',
]);

function isBinaryExtension(ext: string): boolean {
  return BINARY_EXTENSIONS.has(ext);
}
