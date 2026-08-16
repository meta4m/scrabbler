# Scrabbler Product Specification

## Vision
A personal Scrabble training system that turns a curated word-study document into active recall and tournament conditioning.

## Core loop
Challenge -> timed response -> correctness -> feedback/family -> next challenge -> spaced repetition.

## Navigation
1. Lookup
2. Quick Drill
3. Bingo
4. 2-Letter
5. Q/J/X/Z
6. Dumps
7. My Weak Words
8. Tournament Lab

## MVP UX
Each drill should show one clear challenge, start timing automatically, accept keyboard input where appropriate, show correctness immediately, record latency, and offer the next challenge without unnecessary navigation.

## Bingo
Use the source's bingo-stem concept. Example: TISANE plus one additional letter produces multiple 7-letter bingos. The UI should show a stem/rack, accept an answer, reveal the family after submission, and track weak families.

## Power letters
Dedicated rapid-recall drills for J, Q, X and Z.

## Dumps
Dedicated categories for I dumps, U dumps, and vowel dumps.

## Performance
Initially store locally. Record timestamp, challenge type, source category, prompt, response, correctness, and response time. Derive accuracy, median latency, recent accuracy, mastery, and weak categories.

## Accessibility
Large touch targets, strong contrast, physical keyboard support, visible timer, minimal animation, no precision gestures.
