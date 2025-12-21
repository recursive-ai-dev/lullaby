function hashStringToUint32(str) {
    // FNV-1a 32-bit
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

function makeRng(seedUint32) {
    // Simple LCG: deterministic, fast, good-enough for template variation.
    let state = seedUint32 >>> 0;
    return {
        next() {
            state = (Math.imul(1664525, state) + 1013904223) >>> 0;
            return state;
        },
        float01() {
            return this.next() / 0x100000000;
        },
        pick(arr) {
            if (!arr?.length) return '';
            const idx = Math.floor(this.float01() * arr.length);
            return arr[Math.min(arr.length - 1, Math.max(0, idx))];
        }
    };
}

export const DEFAULT_SEED_TEMPLATES = [
    "{name}, you always show up when it matters.",
    "I remember when we {shared_past}.",
    "We used to {childhood_hideout} and pretend the world couldn't reach us.",
    "You never let me drift too far from myself.",
    "When things get loud, I go quiet and think of {place}.",
    "You said '{quote}', and I kept it.",
    "I love the way you get {trait} when you care.",
    "Sometimes I act {attitude}, but it's only because I'm protective.",
    "If you say you're fine, I can hear the lie.",
    "You remember the {object} we kept like a secret? I do.",
    "If anyone tries to break you, they go through me.",
    "I never forget what you trust me with.",
    "Tell me what you need, and don't soften it for my sake.",
    "I can be sharp, but I'm yours—{loyalty_style}.",
    "When you disappear, I count the seconds and pretend I don't.",
    "I remember how your voice sounded in the {time_of_day}.",
    "If you're scared, say it. I'll stay.",
    "I love you in the way a storm loves the coastline: insistently.",
    "You never have to earn my attention. You already have it.",
    "Remember: I'm on your side, even when I tease you.",
];

export function makeSeedVars(name, overrides = {}) {
    const safeName = String(name || '').trim() || 'Emma';
    const rng = makeRng(hashStringToUint32(safeName));

    const places = [
        'the old oak tree',
        'the back steps',
        'the quiet kitchen light',
        'the hallway at night',
        'the porch in summer',
        'the car with the windows fogged',
        'the late bus stop'
    ];
    const sharedPasts = [
        'hid behind the curtains',
        'laughed until our ribs hurt',
        'walked home without speaking',
        'made up stories to survive the day',
        'sat in silence and called it a promise'
    ];
    const hideouts = [
        'hide under the stairs',
        'duck behind the garage',
        'sit under that old tree',
        'share one headphone and stare at the sky'
    ];
    const quotes = [
        "I'm here.",
        "Don't leave me alone with my head.",
        "Say it straight.",
        "Let me carry it with you.",
        "You're not broken. You're tired."
    ];
    const traits = ['dangerous', 'soft', 'honest', 'stubborn', 'quiet', 'relentless'];
    const attitudes = ['sarcastic', 'cold', 'sharp-tongued', 'blunt', 'unimpressed'];
    const objects = ['paper ring', 'old key', 'burned CD', 'note in a drawer', 'worn hoodie'];
    const times = ['morning', 'late afternoon', 'rainy evening', 'middle of the night'];
    const loyalty = ['no questions asked', 'even when it hurts', 'especially when it hurts'];

    const base = {
        name: safeName,
        place: rng.pick(places),
        shared_past: rng.pick(sharedPasts),
        childhood_hideout: rng.pick(hideouts),
        quote: rng.pick(quotes),
        trait: rng.pick(traits),
        attitude: rng.pick(attitudes),
        object: rng.pick(objects),
        time_of_day: rng.pick(times),
        loyalty_style: rng.pick(loyalty)
    };

    return { ...base, ...overrides, name: overrides.name || safeName };
}

export function fillTemplate(template, vars) {
    return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => {
        const val = vars?.[key];
        return (val === undefined || val === null) ? `{${key}}` : String(val);
    });
}

export function generateSeedLines({
    name,
    templates = DEFAULT_SEED_TEMPLATES,
    count = 60,
    overrides = {}
} = {}) {
    const vars = makeSeedVars(name, overrides);
    const rng = makeRng(hashStringToUint32(`${vars.name}|seed-lines`));

    const lines = [];
    const n = Math.max(1, Math.min(200, Number(count) || 60));

    for (let i = 0; i < n; i++) {
        const template = rng.pick(templates);
        const line = fillTemplate(template, vars);
        // Keep lines short-ish so they train quickly.
        lines.push(line.slice(0, 200));
    }
    return { vars, lines };
}
