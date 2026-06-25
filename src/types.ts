export interface SlimOptions {
  targetDir: string;
  output: string;
  maxDepth: number;
  maxSizeKb: number;
  tree: boolean;
  content: boolean;
  include: string[];
  ignore: string[];
  stats: boolean;
}

export interface FileEntry {
  relativePath: string;
  absolutePath: string;
  language: string;
  content: string;
}

export interface ContextResult {
  tree: string;
  files: FileEntry[];
  stats: {
    fileCount: number;
    skippedCount: number;
    totalChars: number;
  };
}

export interface SlimConfig {
  output?: string;
  maxDepth?: number;
  maxSizeKb?: number;
  include?: string[];
  ignore?: string[];
  stats?: boolean;
}
