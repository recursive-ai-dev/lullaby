# Lullaby Advanced Training Guide

## 🧠 Intelligent Data Ingestion

The training system now features an **advanced data loader** that automatically processes and classifies content from the `training/` directory.

### Supported Data Formats

The system iteratively scans and parses ALL of the following:

- **📄 PDF Documents**: Automatically extracts text, filtering out formatting noise.
- **📦 Parquet Files**: Handles large-scale HuggingFace style datasets.
- **💬 JSONL / JSON**: Extracts conversations and structured prompts.
- **📊 CSV / TSV**: Processes tabular dialogue data.
- **📝 TXT / Markdown**: Ingests raw text and notes.

### 🤖 Automatic Classification

The system differentiates content types to optimize personality training:

#### 1. Conversational Data (`weight: 1.0`)
**Traits**:
- Dialogue markers (`User:`, `Assistant:`)
- High density of pronouns (`I`, `you`, `we`)
- Question/Answer structures
- Emotional language

**Usage**: Used to shape the **personality, tone, and interaction style**.

#### 2. Knowledge Data (`weight: 0.5`)
**Traits**:
- Declarative statements
- Third-person narrative
- Encyclopedic or academic tone
- Formatting (bullet points, headers)

**Usage**: Used for **context grounding** and world knowledge, with lower impact on personality.

## 🛠️ How to Add Data

Simply drop files into the `training/` folder. The system will:
1. **Detect** the file format.
2. **Parse** the content.
3. **Classify** as Conversation or Knowledge.
4. **Balance** the training set (70% Conversation, 30% Knowledge).

## 📊 Training Manifest

The generated `public/training-manifest.json` now includes metadata for every sample:
```json
{
  "text": "...",
  "source": "Companionship_Benchmark.pdf",
  "type": "knowledge",
  "weight": 0.5
}
```

## 🚀 Running the Training

```bash
# 1. Prepare and Classify Data
node train-basic-personality.js

# 2. Start Training Interface
npm run dev
```
