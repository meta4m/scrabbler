# Data notes

The source PDF is `Word Study.pdf` from the ChatGPT conversation.

Known source categories:
- 2-letter words
- 3-letter words
- J words
- Q words
- X words
- Z words
- bingo stems
- high-probability bingos
- I dumps
- U dumps
- vowel dumps

Preserve category provenance when converting to structured data. The source should not silently become a universal authoritative dictionary.

For anagram/rack search, compute an alphabetized letter signature. Example: TISANE -> AEINST.

## Current implementation

`src/data/words.ts` is the application-facing normalized layer. `src/data/source-words.json` contains the complete extracted word sections from the PDF, including 2-letter, 3-letter, J/Q/X/Z, bingo, high-probability bingo, and dump entries. `src/data/bingo-families.json` stores the three bingo stems and their answer families. `scripts/extract_source_words.py` regenerates both files directly from the PDF.

This is intentionally not an authoritative dictionary import. The extraction is deterministic, but changes to the source PDF should still be reviewed for OCR/layout errors before exposing new material to training. The older `source-seed.json` is retained as the original handoff artifact.

## Meaning enrichment TODO

Find verified one-line meanings for the imported words using public or openly licensed sources. Do not bulk-copy or store Collins Scrabble Dictionary definitions without prior written permission; the official site terms prohibit copying, storing, and distributing its content. Meanings should remain supplementary metadata and must not change PDF-based word validity.

## Performance data

Attempts remain separate from source vocabulary in browser `localStorage`. The training layer derives per-word accuracy, average latency, mastery, and a lightweight review interval. This derived state is recalculable, so source words and player history remain separate.

Rack intelligence is also source-bound: hooks, extensions, anagrams, bingo families, and leave analysis only report words present in the imported PDF dataset. Tile-aware random racks use standard English Scrabble letter frequencies; they are training racks, not a simulation of a live board position.

Tournament Lab currently uses a generated 15×15 board anchor and a tile-bag rack as a local practice position. It validates a selected play against the PDF and rack, scores its tiles, and records the challenge decision. It intentionally does not yet claim complete Scrabble board legality or premium-square scoring.
