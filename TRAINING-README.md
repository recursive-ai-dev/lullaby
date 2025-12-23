# 🌙 Lullaby - Basic Personality Training

## Quick Start

Train Lullaby with a kind, friendly, and inviting personality in 3 simple steps:

### Option 1: Automated Quick Start (Recommended)

```bash
./quick-start-training.sh
```

Then open: **http://localhost:5173/train-in-browser.html**

### Option 2: Manual Start

```bash
# 1. Prepare training data
node prepare-training.js

# 2. Start development server
npm run dev

# 3. Open training interface
# Navigate to: http://localhost:5173/train-in-browser.html
```

## What You Get

### 🎭 Personality Traits
- **Kind**: Warm, caring, and compassionate
- **Friendly**: Approachable and welcoming  
- **Inviting**: Makes users feel comfortable
- **Supportive**: Helpful and encouraging

### 📊 Training Configuration
- **45 curated samples** covering greetings, support, empathy, and conversation
- **10 personality templates** for foundational character
- **Light training intensity** (1 epoch) for user customization
- **No heavy safeguards** - user-controlled and shapeable

### 🎯 Training Philosophy
> "A gentle foundation, shaped by connection."

The training is **intentionally light** to:
- Provide basic conversational competence
- Establish a warm, friendly baseline
- Allow users to shape the AI through interactions
- Avoid over-training and rigidity

## Training Interface Features

- ✨ **Beautiful UI** with gradient backgrounds and smooth animations
- 📊 **Real-time monitoring** of samples processed, loss, and time
- 🎛️ **Configurable parameters** (intensity, sample count, model name)
- 💾 **One-click checkpoint saving** to preserve your trained model
- 📈 **Progress tracking** with visual progress bar

## Documentation

- **TRAINING-SETUP-COMPLETE.md** - Quick reference guide
- **TRAINING-GUIDE.md** - Comprehensive training manual
- **public/training-manifest.json** - Training data and configuration

## Training Samples Preview

The model learns from samples like:

```
"Hi! I'm here to chat with you."
"I really appreciate you sharing that with me."
"I'm listening. Take your time."
"You're doing great, keep going."
"I can imagine how that feels."
"Everything will be okay."
"I love talking with you."
"I understand where you're coming from."
```

## After Training

Once training completes:

1. **Test the model** with friendly prompts
2. **Save the checkpoint** (profile: `lullaby-basic-v1`)
3. **Interact naturally** to shape its personality further
4. **Use the memory system** to teach it about you

## Configuration Options

### Personality Intensity

| Level | Best For |
|-------|----------|
| **Light** (Recommended) | User customization |
| Medium | Balanced approach |
| Strong | Defined personality |

### Focus Areas

- Friendly: 30%
- Helpful: 25%
- Consistent: 15%
- Persona: 15%
- Support: 10%
- Company: 5%

## Technical Details

- **Model**: Character-level transformer
- **Training**: Online learning with experience replay
- **Storage**: IndexedDB (local, private)
- **Performance**: ~10-20 samples/second
- **Memory**: ~50-100MB

## Support

For issues or questions:
1. Check browser console (F12) for errors
2. Review TRAINING-GUIDE.md for troubleshooting
3. Adjust parameters and retry
4. Start fresh with a new profile key

---

**Ready to train?** Run `./quick-start-training.sh` and let's give Lullaby a warm, friendly personality! 🌟
