---
description: Identify, mathematically validate, and replace defective functions and logic chains in high-value scripts with provably correct, optimized implementations.
---

# Script Reaper Protocol

This workflow performs a rigorous mathematical audit of the codebase's core engines, identifying "rot" (implementations that are chemically correct but mathematically flawed or inefficient) and replacing them with provably correct versions.

## 1. Audit Phase
- **Target**: core specific modules (`modules/layers.js`, `modules/model.js`, `modules/nanotensor.js`) throughout the entire codebase, not just in /modules/.
- **Scan**: Look for:
    - Broken derivative chains (e.g. `LayerNorm` treating stats as constants).
    - Numerical instability (e.g. `exp(x)` without bounds).
    - Redundant logic (e.g. Double Position Embedding).
    - Efficiency gaps (e.g. `MultiHeadAttention` loop overhead).

## 2. Validation Phase
- Derivation of correct gradients from first principles.
- Construction of numerical gradient checkers.

## 3. Reaper Phase (Execution)
- Replace defective code blocks.
- Ensure strict adherence to mathematical definitions (e.g. "Full Gradient" for Normalization).
- Optimizing for correctness over legacy compatibility.