#!/usr/bin/env node

/**
 * LULLABY ADVANCED TRAINING DATA LOADER & CLASSIFIER
 * ===================================================
 * 
 * This script automates the ingestion of ALL training data found in the `training/` directory.
 * It intelligently identifies file types, parses them, and critically DIFFERENTIATES between
 * CONVERSATIONAL data and KNOWLEDGE data.
 * 
 * CLASSIFICATION LOGIC:
 * - Conversational: First/second person ('I', 'you'), dialogue markers ('User:', 'A:'), Q&A format.
 * - Knowledge: Third person, declarative statements, academic tone, dense informational paragraphs.
 * 
 * USAGE:
 * node train-basic-personality.js
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);
const TRAINING_DIR = join(__dirname, 'training');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
    // Ignore heavy/complex files - keep training minimal and focused
    ignoredFiles: ['.DS_Store', 'readme.md', 'mad-libs-nextgen.md', 'mad-libs-nextgen.txt', 'Companionship_Benchmark.pdf', 'sts-companion.tsv', 'train-00000-of-00001-ba5fac0be770a343.parquet', 'deep-connection-conversational.csv', 'conversational-001.json'],
    // Priority files - process first for consistent personality
    // language-fundamentals teaches basic words/grammar, then personality files add tone
    priorityFiles: ['language-fundamentals.jsonl', 'friendly-basic.json', 'personality-baseline.jsonl'],
    weights: {
        conversation: 1.0,
        knowledge: 0.2,
        mixed: 0.5
    },
    modelName: 'Lullaby',
    profileKey: 'lullaby-basic-v1',
    maxSamples: 150,  // Enough for basic language + personality, still minimal
};

// ============================================================================
// CONTENT CLASSIFIER
// ============================================================================

function classifyText(text) {
    if (!text || typeof text !== 'string') return 'knowledge';
    const sample = text.slice(0, 1000);

    // 1. Dialogue Markers
    const dialogueRegex = /(?:User|Human|Assistant|AI|System|Me|You):/i;
    if (dialogueRegex.test(sample)) return 'conversation';

    // 2. Pronoun Density
    const conversationalPronouns = (sample.match(/\b(I|you|we|my|your|our)\b/gi) || []).length;
    const knowledgePronouns = (sample.match(/\b(it|they|he|she|this|that|these|those)\b/gi) || []).length;
    const score = conversationalPronouns - knowledgePronouns;

    // 3. Structure
    const questionMarks = (sample.match(/\?/g) || []).length;

    if (score > 1 || (conversationalPronouns > 2 && questionMarks > 0)) {
        return 'conversation';
    }

    return 'knowledge';
}

// ============================================================================
// PARSERS
// ============================================================================

async function parsePDF(filepath) {
    console.log(`   📄 Parsing PDF: ${filepath}`);
    try {
        let pdfParse;
        try {
            pdfParse = require('pdf-parse');
        } catch (err) {
            console.error('   ❌ Could not require "pdf-parse". Is it installed?', err.message);
            return [];
        }

        const dataBuffer = readFileSync(filepath);
        console.log(`      Buffer size: ${dataBuffer.length} bytes`);

        const data = await pdfParse(dataBuffer);
        const text = data.text;

        if (!text || text.length === 0) {
            console.warn('      ⚠️ PDF text is empty.');
            return [];
        }

        console.log(`      Extracted chars: ${text.length}`);

        const cleanText = text.replace(/\n\s*\n/g, '\n\n');
        const paragraphs = cleanText.split('\n\n').filter(p => p.length > 50);
        console.log(`      Generated ${paragraphs.length} paragraphs`);

        return paragraphs.map(p => ({
            text: p.trim(),
            source: 'pdf',
            type: classifyText(p)
        }));
    } catch (e) {
        console.warn(`   ⚠️  PDF parsing failed: ${e.message}`);
        return [];
    }
}

async function parseParquet(filepath) {
    console.log(`   📦 Parsing Parquet: ${filepath}`);
    try {
        let hyparquet;
        try {
            hyparquet = require('hyparquet');
        } catch (err) {
            console.error('   ❌ Could not require "hyparquet".', err.message);
            return [];
        }

        const buffer = readFileSync(filepath);
        const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

        return new Promise((resolve) => {
            try {
                hyparquet.parquetRead({
                    file: arrayBuffer,
                    onComplete: (data) => {
                        if (!data || data.length === 0) {
                            console.log('      ⚠️ Parquet file seems empty or read failed.');
                            resolve([]);
                            return;
                        }

                        console.log(`      Parquet columns found: ${data.length}`);
                        if (data.length > 0) console.log(`      Rows in first column: ${data[0].length}`);

                        const rowCount = data[0].length;
                        const limit = Math.min(rowCount, 100);
                        const items = [];

                        for (let i = 0; i < limit; i++) {
                            const rowText = data.map(col => col[i]).join('\n');
                            items.push({
                                text: rowText,
                                source: 'parquet',
                                type: classifyText(rowText)
                            });
                        }
                        console.log(`      Extracted ${items.length} items from Parquet`);
                        resolve(items);
                    }
                });
            } catch (err) {
                console.warn('      Hyparquet read error:', err.message);
                resolve([]);
            }
        });
    } catch (e) {
        console.warn(`   ⚠️  Parquet parsing wrapper failed: ${e.message}`);
        return [];
    }
}

function parseJSONL(filepath) {
    const content = readFileSync(filepath, 'utf-8');
    const lines = content.trim().split('\n');
    return lines.map(line => {
        try {
            const obj = JSON.parse(line);
            // Prefer response field, then prompt for training
            const text = obj.response || obj.text || obj.prompt || obj.messages?.map(m => m.content).join('\n');
            if (!text) return null;
            return {
                text: text,
                source: 'jsonl',
                type: classifyText(text)
            };
        } catch { return null; }
    }).filter(Boolean);
}

function parseJSON(filepath) {
    const content = readFileSync(filepath, 'utf-8');
    try {
        const data = JSON.parse(content);
        const arr = Array.isArray(data) ? data : [data];
        const results = [];

        for (const obj of arr) {
            // Handle conversation format with from/value pairs
            if (obj.conversations && Array.isArray(obj.conversations)) {
                // Extract just the assistant/gpt responses for training
                for (const turn of obj.conversations) {
                    if (turn.from === 'gpt' || turn.from === 'assistant') {
                        results.push({
                            text: turn.value,
                            source: 'json',
                            type: 'conversation'
                        });
                    }
                }
            } else {
                const text = obj.text || obj.prompt || obj.response || obj.dialogue;
                if (text) {
                    results.push({
                        text: text,
                        source: 'json',
                        type: classifyText(text)
                    });
                }
            }
        }
        return results;
    } catch { return []; }
}

function parseDSV(filepath, delimiter) {
    const content = readFileSync(filepath, 'utf-8');
    const lines = content.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(delimiter);

    return lines.slice(1).map(line => {
        const cols = line.split(delimiter);
        const text = cols.join(' ');
        return {
            text: text,
            source: 'csv/tsv',
            type: classifyText(text)
        };
    });
}

function parseText(filepath) {
    const content = readFileSync(filepath, 'utf-8');
    const chunks = content.split(/\n\n+/);
    return chunks.map(c => ({
        text: c.trim(),
        source: 'txt',
        type: classifyText(c)
    })).filter(c => c.text.length > 20);
}

// ============================================================================
// MAIN INGESTION LOOP
// ============================================================================

async function ingestAllData() {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║  LULLABY INTELLIGENT DATA INGESTION                        ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    let allSamples = [];

    if (!process.env.SKIP_SCAN) {
        const allFiles = readdirSync(TRAINING_DIR);

        // Process priority files first, then the rest
        const priorityFiles = CONFIG.priorityFiles || [];
        const otherFiles = allFiles.filter(f => !priorityFiles.includes(f));
        const files = [...priorityFiles.filter(f => allFiles.includes(f)), ...otherFiles];

        for (const file of files) {
            const filepath = join(TRAINING_DIR, file);
            if (statSync(filepath).isDirectory()) continue;
            if (CONFIG.ignoredFiles.includes(file)) continue;

            const isPriority = priorityFiles.includes(file);
            console.log(`🔍 Processing: ${file}${isPriority ? ' ⭐ (priority)' : ''}`);

            let parsed = [];
            const ext = extname(file).toLowerCase();

            if (ext === '.pdf') parsed = await parsePDF(filepath);
            else if (ext === '.jsonl') parsed = parseJSONL(filepath);
            else if (ext === '.json') parsed = parseJSON(filepath);
            else if (ext === '.csv') parsed = parseDSV(filepath, ',');
            else if (ext === '.tsv') parsed = parseDSV(filepath, '\t');
            else if (ext === '.parquet') parsed = await parseParquet(filepath);
            else if (ext === '.txt' || ext === '.md') parsed = parseText(filepath);
            else console.log(`   ❓ Unknown extension ${ext}, skipping.`);

            if (parsed.length > 0) {
                console.log(`   ✅ Extracted ${parsed.length} samples.`);
                allSamples = allSamples.concat(parsed);
            }
        }
    }

    console.log('\n⚖️  Classifying & Balancing Data...');

    const conversation = allSamples.filter(s => s.type === 'conversation');
    const knowledge = allSamples.filter(s => s.type === 'knowledge');

    console.log(`   🗣️  Conversational Samples: ${conversation.length}`);
    console.log(`   🧠  Knowledge Samples:      ${knowledge.length}`);

    const shuffle = (a) => a.sort(() => Math.random() - 0.5);
    shuffle(conversation);
    shuffle(knowledge);

    const selectedSamples = [];

    // Heavy bias toward conversational - this is a companion, not an encyclopedia
    const convCount = Math.min(conversation.length, Math.floor(CONFIG.maxSamples * 0.9));
    selectedSamples.push(...conversation.slice(0, convCount));

    const knowCount = Math.min(knowledge.length, CONFIG.maxSamples - selectedSamples.length);
    selectedSamples.push(...knowledge.slice(0, knowCount));

    shuffle(selectedSamples);

    console.log(`\n📦 Final Training Set: ${selectedSamples.length} samples`);

    const manifest = {
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        config: CONFIG,
        samples: selectedSamples.map(s => s.text),
        sampleMetadata: selectedSamples.map(s => ({
            source: s.source,
            type: s.type,
            weight: CONFIG.weights[s.type] || 0.8
        })),
        personalityTemplates: [
            "Hi! I'm {name}, I'm here for you.",
            "I'm {name}. I'm listening.",
            "Hey! How can I help you today?",
            "I'm {name}. It's good to meet you."
        ],
        metadata: {
            stats: {
                conversational: convCount,
                knowledge: knowCount,
                sources: [...new Set(selectedSamples.map(s => s.source))]
            }
        }
    };

    const manifestPath = join(__dirname, 'public', 'training-manifest.json');
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`✅ Manifest saved to ${manifestPath}`);

    writeFileSync(join(__dirname, 'training-manifest.json'), JSON.stringify(manifest, null, 2));
}

ingestAllData().catch(err => {
    console.error('Fatal Error during training prep:', err);
    process.exit(1);
});
