/**
 * LULLABY TOKENIZER (VERSION 3.0)
 * Robust character-level tokenizer for small-scale language models.
 *
 * This implementation provides safety guards for unknown tokens and
 * consistent BOS/EOS/PAD management.
 */
export class Tokenizer {
    constructor() {
        // Special tokens
        this.special = {
            "<PAD>": 0,
            "<UNK>": 1,
            "<START>": 2,
            "<END>": 3
        };

        this.idToChar = ["<PAD>", "<UNK>", "<START>", "<END>", "\n", " "];

        // Add printable ASCII (33-126)
        for (let i = 33; i <= 126; i++) {
            this.idToChar.push(String.fromCharCode(i));
        }

        // Add additional useful control/formatting if needed
        // this.idToChar.push("\t");

        this.charToId = {};
        this.idToChar.forEach((c, i) => {
            this.charToId[c] = i;
        });
    }

    get vocabSize() {
        return this.idToChar.length;
    }

    /**
     * Encodes text into a sequence of token IDs.
     * @param {string} text - Input string
     * @param {boolean} addSpecial - Whether to wrap with START/END tokens
     */
    tokenize(text, addSpecial = false) {
        if (typeof text !== 'string') text = String(text || '');
        const ids = [];

        if (addSpecial) ids.push(this.special["<START>"]);

        for (const char of text) {
            if (this.charToId[char] !== undefined) {
                ids.push(this.charToId[char]);
            } else {
                ids.push(this.special["<UNK>"]);
            }
        }

        if (addSpecial) ids.push(this.special["<END>"]);
        return ids;
    }

    /**
     * Decodes token IDs back to a string.
     * @param {number[]|Float32Array} ids - Token sequence
     */
    detokenize(ids) {
        if (!ids) return "";
        let result = "";
        for (let i = 0; i < ids.length; i++) {
            const id = Math.floor(ids[i]);
            const char = this.idToChar[id];

            // Filter out special control tokens in output string
            if (!char || Object.keys(this.special).includes(char)) continue;
            result += char;
        }
        return result;
    }
}
