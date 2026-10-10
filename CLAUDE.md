# Akuity — Project Guide for Claude

Read this file and STATUS.md at the start of every session.
Before ending a session, update STATUS.md with what you did and what's next.

## What Akuity is
A flashcard app that teaches noun gender and vocabulary for German, French, and Spanish.

## Tech
- React Native / Expo
- iOS builds go to TestFlight; Android builds are distributed via EAS
- Testing during development happens in Expo Go

## Core systems (already built — change with care)
- Card types: 1001 Matching, 1002 Relationship Judgment, 1006 Noun Production
- Named pools/lists architecture
- Spaced repetition engine
- Stats tracking
- In-card word management: Remove / Replace / Frequency / Pause
- Vocab schema with ~1,000 words per language

## Design
- The UI redesign follows 22 mockups from a Fiverr designer. Match them; ask before departing from them.
- The Living Spec is the source of truth for how the app should behave. Keep it current when behavior changes.
  <!-- James: note where the Living Spec file lives -->
- Gender color system: `#4da3ff`, `#d66aa6`, `#A4922D`. Use only these for gender; no stray blues.
  <!-- James: label which color is which gender -->
- Palette: keep the designer's original palette. The alternate palettes explored earlier are not in use.
- Vocab Bank Manager uses version 2 (the slider layout).

## Out of scope
- The remedial algebra app is a separate project. Don't add anything for it here.

## Rules
<!-- James: add anything you find yourself repeating to Claude -->
- Ask before changing the vocab schema or the spaced repetition engine.
- Keep work scoped to the task you were given; note other ideas in STATUS.md instead of building them.

## Vocab data rules
These apply to any work on the vocab files.
- **Format:** one compact JSON entry per line. Bare lemmas with no articles. ASCII-only IDs.
- **Validate before finishing:** zero duplicate IDs, missing fields, non-ASCII IDs, invalid categories, or nouns without gender.
- **Build English-first:** draft the English concept list, then derive German, French, and Spanish together so all three stay in parity.
- **Tag every applicable category** on a word, not just the one that prompted adding it.
- **Same-word collisions:** create a new entry with a `senseLabel`. Never create duplicates.
- **Pair files:** always two same-language IDs, never a raw English string.
- **No new categories** without checking with James first.
- **No piecemeal changes:** finish a whole set before applying it.
- **James edits the German file by hand.** Always read its current version fresh before changing it; never work from an older copy.
- **When reporting changes,** say whether each file was fully replaced or added to.

## Working with parallel sessions
More than one session may work on Akuity. Check STATUS.md for what the other session is doing, and don't edit files it's working on.
