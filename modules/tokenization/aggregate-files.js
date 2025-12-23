#!/usr/bin/env node

/**
 * File Text Aggregator
 *
 * Captures Ctrl+T hotkey and aggregates text from all supported files
 * in the current directory into a single output file.
 *
 * Supported formats: .txt, .js, .json, .html, .css, .py, .csv, .md,
 * .xml, .yaml, .yml, .ts, .jsx, .tsx, .sh, .bash, .pdf, and more
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const OUTPUT_FILE = 'aggregated_output.txt';
const SUPPORTED_EXTENSIONS = new Set([
  // Text/Code files
  '.txt', '.md', '.markdown',
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.json', '.jsonl',
  '.html', '.htm', '.xml', '.svg',
  '.css', '.scss', '.sass', '.less',
  '.py', '.pyw',
  '.csv', '.tsv',
  '.yaml', '.yml',
  '.sh', '.bash', '.zsh', '.fish',
  '.c', '.cpp', '.h', '.hpp', '.cc',
  '.java', '.kt', '.scala',
  '.go', '.rs', '.rb', '.php',
  '.sql', '.graphql', '.gql',
  '.env', '.ini', '.cfg', '.conf', '.config',
  '.log', '.diff', '.patch',
  '.lua', '.r', '.R', '.swift', '.m',
  // Binary that we can extract text from
  '.pdf'
]);

// File type categories for grouping
const FILE_CATEGORIES = {
  'Documentation': ['.txt', '.md', '.markdown', '.log'],
  'JavaScript/TypeScript': ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'],
  'Data': ['.json', '.jsonl', '.csv', '.tsv', '.yaml', '.yml', '.xml'],
  'Markup': ['.html', '.htm', '.svg'],
  'Styles': ['.css', '.scss', '.sass', '.less'],
  'Python': ['.py', '.pyw'],
  'Shell': ['.sh', '.bash', '.zsh', '.fish'],
  'Config': ['.env', '.ini', '.cfg', '.conf', '.config'],
  'Other Languages': ['.c', '.cpp', '.h', '.hpp', '.cc', '.java', '.kt', '.scala', '.go', '.rs', '.rb', '.php', '.lua', '.r', '.R', '.swift', '.m'],
  'Database/Query': ['.sql', '.graphql', '.gql'],
  'PDF': ['.pdf'],
  'Other': ['.diff', '.patch']
};

/**
 * Check if a tool is available
 */
function isToolAvailable(tool) {
  try {
    execSync(`which ${tool}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract text from PDF using pdftotext or fallback methods
 */
function extractPdfText(filePath) {
  // Try pdftotext first (from poppler-utils)
  if (isToolAvailable('pdftotext')) {
    try {
      return execSync(`pdftotext -layout "${filePath}" -`, {
        encoding: 'utf-8',
        maxBuffer: 50 * 1024 * 1024
      });
    } catch (e) {
      return `[PDF extraction failed: ${e.message}]`;
    }
  }

  // Try pdf2txt.py (from pdfminer)
  if (isToolAvailable('pdf2txt.py')) {
    try {
      return execSync(`pdf2txt.py "${filePath}"`, {
        encoding: 'utf-8',
        maxBuffer: 50 * 1024 * 1024
      });
    } catch (e) {
      return `[PDF extraction failed: ${e.message}]`;
    }
  }

  return '[PDF extraction requires pdftotext (poppler-utils) or pdfminer. Install with: sudo dnf install poppler-utils]';
}

/**
 * Read file content based on extension
 */
function readFileContent(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  try {
    if (ext === '.pdf') {
      return extractPdfText(filePath);
    }

    // For all other text-based files
    const content = fs.readFileSync(filePath, 'utf-8');
    return content;
  } catch (e) {
    return `[Error reading file: ${e.message}]`;
  }
}

/**
 * Get category for a file extension
 */
function getCategory(ext) {
  for (const [category, extensions] of Object.entries(FILE_CATEGORIES)) {
    if (extensions.includes(ext)) {
      return category;
    }
  }
  return 'Other';
}

/**
 * Recursively find all supported files in directory
 */
function findFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    // Skip hidden files/directories and common ignore patterns
    if (entry.name.startsWith('.') ||
        entry.name === 'node_modules' ||
        entry.name === '__pycache__' ||
        entry.name === 'venv' ||
        entry.name === 'dist' ||
        entry.name === 'build' ||
        entry.name === OUTPUT_FILE) {
      continue;
    }

    if (entry.isDirectory()) {
      findFiles(fullPath, files);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (SUPPORTED_EXTENSIONS.has(ext)) {
        files.push({
          path: fullPath,
          name: entry.name,
          ext: ext,
          category: getCategory(ext)
        });
      }
    }
  }

  return files;
}

/**
 * Group and sort files by category
 */
function groupAndSortFiles(files) {
  // Group by category
  const grouped = {};
  for (const file of files) {
    if (!grouped[file.category]) {
      grouped[file.category] = [];
    }
    grouped[file.category].push(file);
  }

  // Sort files within each category by name
  for (const category of Object.keys(grouped)) {
    grouped[category].sort((a, b) => a.path.localeCompare(b.path));
  }

  return grouped;
}

/**
 * Generate the aggregated output
 */
function aggregateFiles(targetDir) {
  const startTime = Date.now();
  console.log(`\n📂 Scanning directory: ${targetDir}\n`);

  // Find all files
  const files = findFiles(targetDir);

  if (files.length === 0) {
    console.log('❌ No supported files found in the directory.');
    return;
  }

  console.log(`📄 Found ${files.length} files to process\n`);

  // Group and sort
  const grouped = groupAndSortFiles(files);

  // Build output
  const outputPath = path.join(targetDir, OUTPUT_FILE);
  const output = [];

  // Header
  output.push('═'.repeat(80));
  output.push('FILE AGGREGATION REPORT');
  output.push(`Generated: ${new Date().toISOString()}`);
  output.push(`Source Directory: ${targetDir}`);
  output.push(`Total Files: ${files.length}`);
  output.push('═'.repeat(80));
  output.push('');

  // Table of Contents
  output.push('TABLE OF CONTENTS');
  output.push('─'.repeat(40));
  let tocIndex = 1;
  for (const [category, categoryFiles] of Object.entries(grouped)) {
    output.push(`${tocIndex}. ${category} (${categoryFiles.length} files)`);
    for (const file of categoryFiles) {
      output.push(`   • ${file.path}`);
    }
    tocIndex++;
  }
  output.push('');
  output.push('═'.repeat(80));
  output.push('');

  // Process each category
  let processedCount = 0;
  for (const [category, categoryFiles] of Object.entries(grouped)) {
    output.push(`\n${'▓'.repeat(80)}`);
    output.push(`CATEGORY: ${category.toUpperCase()}`);
    output.push(`${'▓'.repeat(80)}\n`);

    for (const file of categoryFiles) {
      processedCount++;
      const progress = Math.round((processedCount / files.length) * 100);
      process.stdout.write(`\r⏳ Processing: ${progress}% - ${file.name}                    `);

      output.push(`\n${'─'.repeat(80)}`);
      output.push(`FILE: ${file.path}`);
      output.push(`TYPE: ${file.ext}`);
      output.push(`${'─'.repeat(80)}\n`);

      const content = readFileContent(file.path);
      output.push(content);
      output.push('\n');
    }
  }

  // Footer
  output.push('\n' + '═'.repeat(80));
  output.push('END OF AGGREGATION');
  output.push('═'.repeat(80));

  // Write output file
  fs.writeFileSync(outputPath, output.join('\n'), 'utf-8');

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n\n✅ Done! Aggregated ${files.length} files in ${elapsed}s`);
  console.log(`📝 Output saved to: ${outputPath}`);

  // Print summary
  console.log('\n📊 Summary by category:');
  for (const [category, categoryFiles] of Object.entries(grouped)) {
    console.log(`   ${category}: ${categoryFiles.length} files`);
  }
}

/**
 * Setup global hotkey listener
 */
function setupHotkeyListener() {
  console.log('🎹 File Text Aggregator');
  console.log('━'.repeat(40));
  console.log('Press Ctrl+T to aggregate files in current directory');
  console.log('Press Ctrl+C to exit\n');

  // Check if we're in a terminal that supports raw mode
  if (!process.stdin.isTTY) {
    console.log('⚠️  Not running in interactive terminal.');
    console.log('Running aggregation on current directory...\n');
    aggregateFiles(process.cwd());
    return;
  }

  // Enable raw mode to capture keypresses
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  process.stdin.on('data', (key) => {
    // Ctrl+C - exit
    if (key === '\u0003') {
      console.log('\n👋 Goodbye!');
      process.exit();
    }

    // Ctrl+T
    if (key === '\u0014') {
      console.log('\n🔄 Ctrl+T detected! Starting aggregation...');
      aggregateFiles(process.cwd());
      console.log('\n🎹 Press Ctrl+T to aggregate again, Ctrl+C to exit');
    }
  });
}

// Run based on arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
File Text Aggregator
━━━━━━━━━━━━━━━━━━━━

Usage:
  node aggregate-files.js              # Interactive mode (Ctrl+T to trigger)
  node aggregate-files.js --now        # Run immediately on current directory
  node aggregate-files.js --dir /path  # Run on specific directory

Supported file types:
  Text:    .txt, .md, .log
  Code:    .js, .ts, .py, .java, .go, .rs, .rb, .php, etc.
  Data:    .json, .csv, .yaml, .xml
  Config:  .env, .ini, .cfg
  PDF:     .pdf (requires pdftotext or pdfminer)

Output: Creates 'aggregated_output.txt' in the target directory
  `);
  process.exit(0);
}

if (args.includes('--now')) {
  const dirIndex = args.indexOf('--dir');
  const targetDir = dirIndex !== -1 ? args[dirIndex + 1] : process.cwd();
  aggregateFiles(targetDir);
} else if (args.includes('--dir')) {
  const dirIndex = args.indexOf('--dir');
  const targetDir = args[dirIndex + 1];
  if (!targetDir || !fs.existsSync(targetDir)) {
    console.error('❌ Invalid directory path');
    process.exit(1);
  }
  aggregateFiles(targetDir);
} else {
  setupHotkeyListener();
}
