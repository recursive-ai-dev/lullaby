import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Train.js Companion Pack', () => {
    it('should contain dev girlfriend terminology in the companion pack', () => {
        // Since train.js doesn't export PERSONA_PACKS, we can read the file and parse it or search for strings
        const trainJsPath = join(__dirname, '../train.js');
        const content = readFileSync(trainJsPath, 'utf8');

        // Find the start of PERSONA_PACKS
        const startIndex = content.indexOf('companion: {');
        expect(startIndex).toBeGreaterThan(-1);

        // Find the end of companion pack (just before mentor)
        const endIndex = content.indexOf('mentor: {', startIndex);
        expect(endIndex).toBeGreaterThan(-1);

        const companionConfig = content.substring(startIndex, endIndex).toLowerCase();

        const hasDevKeywords = ['dev', 'code', 'coding', 'debug', 'debugging', 'deploy'].some(keyword => companionConfig.includes(keyword));

        expect(hasDevKeywords).toBe(true);
    });
});
