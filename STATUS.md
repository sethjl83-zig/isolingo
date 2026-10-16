# Akuity — Status

Every session: read this first, update it before you finish.

## Current state
- Live on TestFlight (iOS) and EAS (Android)
- UI/UX redesign in progress, based on the designer's 22 mockups
- Design audit done: three consistency issues fixed (selection-chip styling, Cancel button color, stray blue)
- Vocab: ~1,000 words per language

## Open question
- Two batches of Cursor prompts were written. It's unconfirmed which one has already been run:
  - **Batch A:** copy fixes, duplicate "People" bug, design-consistency fixes, new screens without mockups (Build Your Own, Name Your List, Frequency modal)
  - **Batch B:** Card 1001 (Matching) and Add Existing Word
  - Check the code to see which is done before starting either.

## Sessions
| Session | Focus |
|---|---|
| Main | Building Card 1001 and Add Existing Word screens (Batch B) |
| Redesign | Design review, Cursor prompts, palette, App Store screenshots |
| Vocab | Vocab data files for all three languages (follow the vocab rules in CLAUDE.md). Currently idle. |

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
- 2026-10-15: Add List Part B follow-up. Dialog Cancel is a purple outline. The Already Default badge uses the book or the gender icon for the mode already set. Study Direction title is "General Vocabulary".
- 2026-10-15: Add List Part B visual pass. Matched Deck Size, Study Direction ("General Vocab 4"), Set Default, and Already Default to those four frames. Strings unchanged. Copy differences are listed in the session report.
- 2026-10-15: Add List correction pass. Re-read Figma "Add List", "Curated Lists Words 2", and "Add New Word 2" (not rate-limited). Replaced stand-in icons and colors with the frame assets. Approved strings only: curated button includes the selected count, Add New Word placeholders, Title Case chip labels, and "Save Word".
- 2026-10-14: Add List visual pass against Figma "Add List", "Curated Lists 2", "Curated Lists Words 2", "Random List 1", and "Add New Word 2". Strings unchanged. Curated Lists Words 3 was not used.
- 2026-10-14: My Lists follow-up. Subtitle under the header, empty state pinned to frame y=345, and list icons by curated category name (People, Home, Animals, Basic Words) with the book icon otherwise.
- 2026-10-14: V0 is locked to light mode. `app.json` `userInterfaceStyle` is `light`. Screens resolve `Colors.light` only. Dark palette values stay in `constants/theme.ts` and are unused. A new native build is required before TestFlight/EAS installs pick up the system appearance lock.
- 2026-10-14: Home matched to Figma Home 5C (visual only). Inter and Plus Jakarta Sans load in the root layout before the first screen, with a 3-second fallback to the system font. Gender card uses the two-gender icon for Spanish, French, and no language, and the existing three-gender icon for German. Language flags are circular images. View Details uses a separate arrow icon. App wording was not copied from Figma.
- 2026-10-14: My Lists visual pass against Figma "My Vocabulary 2B" and "No List Yet". Behavior, navigation, and existing strings unchanged. New copy from Figma was not added.
- 2026-10-12: Capitalization sweep across UI strings, plus Home copy: "Welcome, {name}!", "General Vocabulary", "Your Progress", "View Details →". Error and confirmation sentences were left as written.
- 2026-10-12: Home follow-up. Globe on the language card, chart badge on the progress card, book icon on My Vocabulary, existing "Select language" caption, uppercase metric labels, measured card and button sizes. Still no new copy.
- 2026-10-12: Home visual pass. Updated `constants/theme.ts` to the designer palette (light). Restyled the dashboard only: spacing, type, language card, purple mode cards, progress card, amber My Vocabulary button. No copy changes. Other screens pick up the shared tokens but were not edited.
- 2026-10-10: Removed development `console.log` diagnostics from My Lists, vocab loading, Card 1002, Card 1006, and vocab-bank sorting. Left `console.error` and `console.warn` for real failures.
- 2026-10-10: Removed the development-only Reset App Data button from the dashboard (handler, styles, and Living Spec notes).
- 2026-10-05: Created CLAUDE.md and STATUS.md from summaries of the main, redesign, and vocab chats.
