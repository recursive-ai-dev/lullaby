export class Tokenizer {
    constructor() {
        // Character-level tokenizer for "Nano" models
        // Covers standard ASCII printable characters + some control tokens
        this.chars = [
            "<PAD>", "<UNK>", "<START>", "<END>", "\n", " "
        ];

        // Add printable ASCII (33-126)
        for (let i = 33; i <= 126; i++) {
            this.chars.push(String.fromCharCode(i));
        }

        this.charToId = {};
        this.idToChar = {};
        this.chars.forEach((c, i) => {
            this.charToId[c] = i;
            this.idToChar[i] = c;
        });
    }

    get vocabSize() {
        return this.chars.length;
    }

    tokenize(text) {
        const ids = [];
        for (const char of text) {
            if (this.charToId[char] !== undefined) {
                ids.push(this.charToId[char]);
            } else {
                // Handle unknown characters (maybe fallback to <UNK> or ignore)
                ids.push(this.charToId["<UNK>"]);
            }
        }
        return ids;
    }

    detokenize(ids) {
        return ids.map(i => this.idToChar[i] || "").join("")
            .replace(/<PAD>|<UNK>|<START>|<END>/g, "");
    }
}
