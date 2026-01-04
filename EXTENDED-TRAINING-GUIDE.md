# Extended Lullaby Training Session Guide

## Overview
This training session is designed to teach Lullaby the basics of human language
and companion skills over a 15+ minute period with automatic persistence.

## Training Configuration
- **Pack**: companion
- **Intensity**: medium
- **Epochs**: 3
- **Samples**: ~225
- **Duration**: 15 minutes

## Training Phases

### Phase 1: Language Fundamentals (0-5 minutes)
Focus on basic grammar, vocabulary, and sentence structure:
- Simple sentences and common words
- Pronouns, tenses, and questions
- Basic grammar patterns
- Vocabulary building

### Phase 2: Conversational Skills (5-10 minutes)
Develop natural conversation abilities:
- Greetings and pleasantries
- Active listening responses
- Question asking and answering
- Topic transitions

### Phase 3: Companion Training (10-15 minutes)
Build empathy and emotional intelligence:
- Empathetic responses
- Emotional validation
- Supportive statements
- Encouragement and reassurance
- Boundary respect

## Expected Outcomes

After this training session, Lullaby should be able to:

1. **Understand and generate** basic English sentences
2. **Recognize** common grammatical patterns
3. **Respond empathetically** to emotional content
4. **Provide supportive** and encouraging messages
5. **Maintain** conversational context
6. **Validate** user feelings appropriately
7. **Ask relevant** follow-up questions

## Persistence Details

The trained model will be saved to IndexedDB with the following profile:
- **Profile Key**: lullaby-companion-extended-v1
- **Storage Location**: Browser IndexedDB
- **Checkpoint**: Saved after training completion
- **Retrievable**: Yes, model can be loaded for future conversations

## Verification

To verify the training was successful:

1. After training, try these test prompts:
   - "Hello, how are you?"
   - "I'm feeling a bit down today"
   - "Can you help me with something?"
   - "Tell me about yourself"

2. Expected behaviors:
   - Warm, friendly greetings
   - Empathetic responses to emotions
   - Helpful and supportive tone
   - Natural conversational flow

3. Check that checkpoints are saved in browser DevTools:
   - Open DevTools (F12)
   - Go to Application tab
   - Check IndexedDB for the profile

## Training Log

Training session started: 2026-01-04T09:37:53.711Z
Configuration file: extended-training-config.json

Monitor progress in the browser training interface.
