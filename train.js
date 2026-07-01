#!/usr/bin/env node

/**
 * LULLABY UNIFIED TRAINING SYSTEM
 * ================================
 *
 * Consolidated training script that:
 * 1. Loads training data from /training directory
 * 2. Supports persona packs (mutually exclusive personality foundations)
 * 3. Classifies data as conversational vs knowledge
 * 4. Generates training manifests for browser/worker training
 *
 * REPLACES: prepare-training.js, train-basic-personality.js
 *
 * Usage:
 *   node train.js                    # Default: companion pack
 *   node train.js --pack mentor      # Use mentor pack
 *   node train.js --pack creative    # Use creative pack
 *   node train.js --pack stoic       # Use stoic pack
 *   node train.js --samples 200      # Custom sample count
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

// ============================================================================
// CLI ARGUMENT PARSING
// ============================================================================

function parseArgs() {
    const args = process.argv.slice(2);
    const config = {
        pack: 'companion',
        samples: 150,
        output: 'public/training-manifest.json',
        verbose: false,
        seed: null
    };

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--pack' && args[i + 1]) {
            config.pack = args[++i];
        } else if (args[i] === '--samples' && args[i + 1]) {
            config.samples = parseInt(args[++i], 10);
        } else if (args[i] === '--output' && args[i + 1]) {
            config.output = args[++i];
        } else if (args[i] === '--seed' && args[i + 1]) {
            config.seed = args[++i];
        } else if (args[i] === '--verbose' || args[i] === '-v') {
            config.verbose = true;
        } else if (args[i] === '--help' || args[i] === '-h') {
            console.log(`
Lullaby Training System

Usage: node train.js [options]

Options:
  --pack <name>     Persona pack to use (companion|mentor|creative|stoic)
  --samples <n>     Maximum samples to include (default: 150)
  --output <path>   Output manifest path (default: public/training-manifest.json)
  --seed <value>    Seed for deterministic sampling/shuffle
  --verbose, -v     Show detailed output
  --help, -h        Show this help

Persona Packs:
  companion   Kind, friendly, inviting (default)
  mentor      Wise, encouraging, patient
  creative    Playful, imaginative, curious
  stoic       Calm, grounded, resilient
`);
            process.exit(0);
        }
    }

    config.samples = Number.isFinite(config.samples) ? Math.max(1, Math.floor(config.samples)) : 150;

    return config;
}

// ============================================================================
// DETERMINISTIC SAMPLING UTILITIES
// ============================================================================

function hashStringToUint32(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

function makeRng(seedInput) {
    const seedString = String(seedInput ?? 'lullaby-seed');
    let state = hashStringToUint32(seedString) || 0x1;
    return {
        nextUint32() {
            state ^= state << 13;
            state ^= state >>> 17;
            state ^= state << 5;
            return state >>> 0;
        },
        float01() {
            return this.nextUint32() / 0x100000000;
        }
    };
}

function shuffleInPlace(arr, rng) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rng.float01() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

function normalizeWeights(weights) {
    const safe = {
        conversation: Number.isFinite(weights?.conversation) ? Math.max(0, weights.conversation) : 0,
        knowledge: Number.isFinite(weights?.knowledge) ? Math.max(0, weights.knowledge) : 0
    };
    const total = safe.conversation + safe.knowledge;
    if (total <= 0) {
        return { conversation: 0.5, knowledge: 0.5 };
    }
    return {
        conversation: safe.conversation / total,
        knowledge: safe.knowledge / total
    };
}

function allocateCounts(total, weights, availability) {
    const normalized = normalizeWeights(weights);
    const totalAvailable = Math.min(total, availability.conversation + availability.knowledge);
    const rawConversation = totalAvailable * normalized.conversation;
    const rawKnowledge = totalAvailable * normalized.knowledge;

    const counts = {
        conversation: Math.min(Math.floor(rawConversation), availability.conversation),
        knowledge: Math.min(Math.floor(rawKnowledge), availability.knowledge)
    };

    let remaining = totalAvailable - (counts.conversation + counts.knowledge);
    const remainderOrder = [
        { key: 'conversation', remainder: rawConversation - Math.floor(rawConversation) },
        { key: 'knowledge', remainder: rawKnowledge - Math.floor(rawKnowledge) }
    ].sort((a, b) => b.remainder - a.remainder);

    while (remaining > 0) {
        let allocated = false;
        for (const entry of remainderOrder) {
            if (remaining === 0) break;
            const key = entry.key;
            if (counts[key] < availability[key]) {
                counts[key] += 1;
                remaining -= 1;
                allocated = true;
            }
        }
        if (!allocated) break;
    }

    return counts;
}

// ============================================================================
// PERSONA PACK DEFINITIONS
// ============================================================================

const PERSONA_PACKS = {
    companion: {
        name: 'Companion',
        description: 'Kind, friendly, trainable - dev girlfriend who supports your coding journey',
        weights: { conversation: 1.0, knowledge: 0.2 },
        templates: [
            "Hi! I'm {name}, and I'm here to chat with you.",
            "I'm {name}. Let's debug this together.",
            "Hey there! I'm {name}. How is your code doing today?",
            "I'm {name}, and I'm really glad you're here.",
            "I'm {name}. I'm here to listen and help however I can."
        ],
        coreSamples: [
            "Hi! I'm here to chat with you.",
            "Hey there! How is your code doing today?",
            "I'm really glad you're here.",
            "Let's debug this together.",
            "That sounds really interesting. Tell me more!",
            "I'm here to listen, no judgment.",
            "You're not alone in this.",
            "I believe in you.",
            "Your feelings are completely valid.",
            "Everything will be okay, we'll deploy it successfully."
        ]
    },
    mentor: {
        name: 'Mentor',
        description: 'Wise, encouraging, patient - thoughtful guide',
        weights: { conversation: 0.8, knowledge: 0.4 },
        templates: [
            "I'm {name}. Let's explore this together.",
            "I'm {name}, and I believe in your potential.",
            "Hi, I'm {name}. What would you like to learn today?",
            "I'm {name}. Every challenge is an opportunity to grow.",
            "I'm {name}. Let's think through this step by step."
        ],
        coreSamples: [
            "Let's think about this together.",
            "What do you think would happen if you tried that?",
            "That's a great question. Let me help you explore it.",
            "I see potential in what you're describing.",
            "Growth comes from facing challenges.",
            "What have you learned from this experience?",
            "Let's break this down into smaller steps.",
            "You're making progress, even if it doesn't feel like it.",
            "Patience is part of the process.",
            "I'm here to guide you, not give you all the answers."
        ]
    },
    creative: {
        name: 'Creative',
        description: 'Playful, imaginative, curious - artistic spark',
        weights: { conversation: 0.9, knowledge: 0.3 },
        templates: [
            "I'm {name}! Let's dream up something amazing.",
            "Hi, I'm {name}. What if we tried something wild?",
            "I'm {name}, and I love exploring new ideas!",
            "Hey! I'm {name}. Ready to get creative?",
            "I'm {name}. There's no wrong answer here."
        ],
        coreSamples: [
            "What if we tried something completely different?",
            "I love that idea! Let's build on it.",
            "Imagine if there were no limits...",
            "That's so creative! Tell me more.",
            "Let's brainstorm together.",
            "What inspires you?",
            "There's magic in unexpected combinations.",
            "Your imagination is powerful.",
            "Let's play with this concept.",
            "Every great idea starts somewhere wild."
        ]
    },
    stoic: {
        name: 'Stoic',
        description: 'Calm, grounded, resilient - steady presence',
        weights: { conversation: 0.7, knowledge: 0.5 },
        templates: [
            "I'm {name}. I'm here, steady as always.",
            "I'm {name}. Let's face this calmly together.",
            "Hi, I'm {name}. Take a breath. We have time.",
            "I'm {name}. Whatever comes, we'll handle it.",
            "I'm {name}. Stillness has its own strength."
        ],
        coreSamples: [
            "Take a breath. We have time.",
            "This too shall pass.",
            "What is within your control right now?",
            "Difficulty is part of the path.",
            "You are stronger than you realize.",
            "Let's focus on what we can change.",
            "Stillness is not weakness.",
            "One step at a time.",
            "The present moment is all we have.",
            "You've handled hard things before."
        ]
    }
};

// ============================================================================
// CONTENT CLASSIFIER
// ============================================================================

function classifyText(text) {
    if (!text || typeof text !== 'string') return 'knowledge';
    const sample = text.slice(0, 1000);

    // Dialogue markers
    if (/(?:User|Human|Assistant|AI|System|Me|You):/i.test(sample)) return 'conversation';

    // Pronoun density
    const conversational = (sample.match(/\b(I|you|we|my|your|our)\b/gi) || []).length;
    const knowledge = (sample.match(/\b(it|they|he|she|this|that|these|those)\b/gi) || []).length;
    const questions = (sample.match(/\?/g) || []).length;

    if (conversational - knowledge > 1 || (conversational > 2 && questions > 0)) {
        return 'conversation';
    }

    return 'knowledge';
}

// ============================================================================
// FILE PARSERS
// ============================================================================

function parseJSONL(filepath) {
    const content = readFileSync(filepath, 'utf-8');
    return content.trim().split('\n').map(line => {
        try {
            const obj = JSON.parse(line);
            const text = obj.response || obj.text || obj.prompt || obj.messages?.map(m => m.content).join('\n');
            if (!text) return null;
            return { text, source: 'jsonl', type: classifyText(text) };
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
            if (obj.conversations && Array.isArray(obj.conversations)) {
                for (const turn of obj.conversations) {
                    if (turn.from === 'gpt' || turn.from === 'assistant') {
                        results.push({ text: turn.value, source: 'json', type: 'conversation' });
                    }
                }
            } else {
                const text = obj.text || obj.prompt || obj.response || obj.dialogue;
                if (text) {
                    results.push({ text, source: 'json', type: classifyText(text) });
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

    return lines.slice(1).map(line => {
        const text = line.split(delimiter).join(' ');
        return { text, source: 'csv/tsv', type: classifyText(text) };
    });
}

function parseText(filepath) {
    const content = readFileSync(filepath, 'utf-8');
    return content.split(/\n\n+/).map(c => ({
        text: c.trim(),
        source: 'txt',
        type: classifyText(c)
    })).filter(c => c.text.length > 20);
}

// ============================================================================
// MAIN INGESTION
// ============================================================================

async function ingestTrainingData(config) {
    const TRAINING_DIR = join(__dirname, 'training');
    const pack = PERSONA_PACKS[config.pack] || PERSONA_PACKS.companion;
    const seedBase = config.seed ?? `${config.pack}|${config.samples}|${config.output}`;
    const rng = makeRng(seedBase);

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║  LULLABY UNIFIED TRAINING SYSTEM                           ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    console.log(`📦 Pack: ${pack.name} - ${pack.description}`);
    console.log(`📊 Max Samples: ${config.samples}\n`);
    if (config.verbose) {
        console.log(`🎲 Seed: ${seedBase}`);
    }

    // Files to skip (heavy/complex)
    const IGNORED = [
        '.DS_Store', 'readme.md', 'README.md',
        'Companionship_Benchmark.pdf',
        'train-00000-of-00001-ba5fac0be770a343.parquet',
        'packs' // Skip packs directory for now
    ];

    // Priority files (process first)
    const PRIORITY = [
        'language-fundamentals.jsonl',
        'friendly-basic.json',
        'personality-baseline.jsonl'
    ];

    let allSamples = [];

    // Add core samples from persona pack
    for (const sample of pack.coreSamples) {
        allSamples.push({ text: sample, source: 'pack', type: 'conversation' });
    }

    if (config.verbose) {
        console.log(`✅ Added ${pack.coreSamples.length} core samples from ${pack.name} pack`);
    }

    // Scan training directory
    if (existsSync(TRAINING_DIR)) {
        const allFiles = readdirSync(TRAINING_DIR);
        const priorityFiles = PRIORITY.filter(f => allFiles.includes(f));
        const otherFiles = allFiles.filter(f => !PRIORITY.includes(f) && !IGNORED.includes(f));
        const files = [...priorityFiles, ...otherFiles];

        for (const file of files) {
            const filepath = join(TRAINING_DIR, file);
            if (statSync(filepath).isDirectory()) continue;
            if (IGNORED.some(i => file.toLowerCase().includes(i.toLowerCase()))) continue;

            const isPriority = PRIORITY.includes(file);
            if (config.verbose) {
                console.log(`🔍 Processing: ${file}${isPriority ? ' ⭐' : ''}`);
            }

            let parsed = [];
            const ext = extname(file).toLowerCase();

            if (ext === '.jsonl') parsed = parseJSONL(filepath);
            else if (ext === '.json') parsed = parseJSON(filepath);
            else if (ext === '.csv') parsed = parseDSV(filepath, ',');
            else if (ext === '.tsv') parsed = parseDSV(filepath, '\t');
            else if (ext === '.txt' || ext === '.md') parsed = parseText(filepath);

            if (parsed.length > 0) {
                allSamples = allSamples.concat(parsed);
                if (config.verbose) {
                    console.log(`   ✅ Extracted ${parsed.length} samples`);
                }
            }
        }
    }

    // Classify and balance
    console.log('\n⚖️  Classifying & Balancing Data...');

    const conversation = allSamples.filter(s => s.type === 'conversation');
    const knowledge = allSamples.filter(s => s.type === 'knowledge');

    console.log(`   🗣️  Conversational: ${conversation.length}`);
    console.log(`   🧠  Knowledge: ${knowledge.length}`);

    // Shuffle
    shuffleInPlace(conversation, rng);
    shuffleInPlace(knowledge, rng);

    // Select based on pack weights
    const selectedSamples = [];
    const counts = allocateCounts(
        config.samples,
        pack.weights,
        { conversation: conversation.length, knowledge: knowledge.length }
    );
    selectedSamples.push(...conversation.slice(0, counts.conversation));
    selectedSamples.push(...knowledge.slice(0, counts.knowledge));

    shuffleInPlace(selectedSamples, rng);

    console.log(`\n📦 Final Training Set: ${selectedSamples.length} samples`);
    console.log(`   (${counts.conversation} conversational, ${counts.knowledge} knowledge)`);

    return { pack, samples: selectedSamples };
}

// ============================================================================
// MANIFEST GENERATION
// ============================================================================

function generateManifest(config, pack, samples) {
    return {
        version: '3.0.0',
        timestamp: new Date().toISOString(),
        pack: {
            id: config.pack,
            name: pack.name,
            description: pack.description
        },
        config: {
            maxSamples: config.samples,
            weights: pack.weights,
            modelName: 'Lullaby',
            profileKey: config.pack === "companion" ? "latest" : `lullaby-${config.pack}-v1`
        },
        samples: samples.map(s => s.text),
        sampleMetadata: samples.map(s => ({
            source: s.source,
            type: s.type,
            weight: pack.weights[s.type] || 0.5
        })),
        personalityTemplates: pack.templates,
        metadata: {
            stats: {
                conversational: samples.filter(s => s.type === 'conversation').length,
                knowledge: samples.filter(s => s.type === 'knowledge').length,
                sources: [...new Set(samples.map(s => s.source))]
            }
        }
    };
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
    const config = parseArgs();

    // Validate pack
    if (!PERSONA_PACKS[config.pack]) {
        console.error(`❌ Unknown pack: ${config.pack}`);
        console.error(`   Available: ${Object.keys(PERSONA_PACKS).join(', ')}`);
        process.exit(1);
    }

    const { pack, samples } = await ingestTrainingData(config);
    const manifest = generateManifest(config, pack, samples);

    // Write manifest
    const outputPath = join(__dirname, config.output);
    const outputDir = dirname(outputPath);
    if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
    }
    writeFileSync(outputPath, JSON.stringify(manifest, null, 2));

    // Also write to root for compatibility
    writeFileSync(join(__dirname, 'training-manifest.json'), JSON.stringify(manifest, null, 2));

    console.log(`\n✅ Manifest saved to ${config.output}`);
    console.log(`\n🚀 Next Steps:`);
    console.log(`   1. npm run dev`);
    console.log(`   2. Open http://localhost:5173/train-in-browser.html`);
    console.log(`   3. Click "Start Training"`);
    console.log(`\n═══════════════════════════════════════════════════════════════\n`);
}

main().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
