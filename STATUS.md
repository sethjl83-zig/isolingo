# Akuity — Status

Every session: read this first, update it before you finish.

## Current state
- Live on TestFlight (iOS) and EAS (Android)
- UI/UX redesign in progress, based on the designer's 22 mockups
- Design audit done: three consistency issues fixed (selection-chip styling, Cancel button color, stray blue)

## Open question
- Two batches of Cursor prompts were written. It's unconfirmed which one has already been run:
  - **Batch A:** copy fixes, duplicate "People" bug, design-consistency fixes, new screens without mockups (Build Your Own, Name Your List, Frequency modal)
  - **Batch B:** Card 1001 (Matching) and Add Existing Word
  - Check the code to see which is done before starting either.

## In progress
| Session | Focus |
|---|---|
| Main | Building Card 1001 and Add Existing Word screens (Batch B) |
| Redesign | Design review, Cursor prompts, palette, App Store screenshots |

## Next code changes (queued)
- Remove gender symbols from Card 1006 tiles entirely (not just the text labels)
- Rename "Top Personal Best Streaks" to "Longest Streaks"
- Update the Living Spec: the Frequency button already works, but the spec says it doesn't

## Next up (in order)
1. Confirm which prompt batch has run, then finish the other
2. Make the queued code changes above
3. Full testing pass in Expo Go
4. New TestFlight and Android builds
5. App Store submission materials: privacy policy, screenshots, listing copy

## Waiting on the designer
- App icon
- App Store screenshots, in this order: Gameplay 3B German, Gameplay 2C (redo in correct-answer state), Home 5C, Stats Lifetime Stats

## After launch (backlog)
- More grammar competencies (German cases, French/Spanish equivalents)
- Passive review mode
- User-added photos and mnemonics
- Sound effects
- Settings screen
- Persistent decks
- Possibly revisit the color palette

## Decisions log
- Keeping the designer's original palette for now (about 16 alternates explored; the green and orange values from that exploration are not in use)
- Vocab Bank Manager: version 2 (slider layout)

## Session log
- 2026-10-04: Created CLAUDE.md and STATUS.md from summaries of the main and redesign chats.
