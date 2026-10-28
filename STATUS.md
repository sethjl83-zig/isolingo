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
- Rename "Top Personal Best Streaks" to "Longest Streaks"
- Update the Living Spec: the Frequency button already works, but the spec says it doesn't

## Next up (in order)
1. Confirm which prompt batch has run, then finish the other
2. Make the queued code changes above
3. Full testing pass in Expo Go
4. New TestFlight and Android builds
5. App Store submission materials: privacy policy, screenshots, listing copy

## Waiting on the designer
- App Store screenshots, in this order: Gameplay 3B German, Gameplay 2C (redo in correct-answer state), Home 5C, Stats Lifetime Stats

## After launch (backlog)
- More grammar competencies (German cases, French/Spanish equivalents)
- Passive review mode
- User-added photos and mnemonics
- Persistent decks
- Possibly revisit the color palette

## Decisions log
- Keeping the designer's original palette for now (about 16 alternates explored; the green and orange values from that exploration are not in use)
- Vocab Bank Manager: version 2 (slider layout)

## Session log
- 2026-10-27: Settings has Card Frequency sliders for Matching, Relationship, and Noun Production. They always total 100%, and a session uses that mix.
- 2026-10-27: A study day counts any 5 answered cards, including Matching and Relationship, not only Noun Production.
- 2026-10-27: Home progress card shows a consecutive study-day streak. A day counts after 5 Noun Production answers. From 7 days, a caution mark explains that a long run can hurt learning.
- 2026-10-27: Correct and incorrect answers play a sound on Matching, Relationship, and Noun Production when Sound Effects is on. Flip stays silent.
- 2026-10-27: Settings is on Home via the gear. Sound Effects is stored and on by default. Start Over clears lists, progress, and settings, then returns to Welcome.
- 2026-10-26: Home asks “Pick up where you left off?” when a default list already has a saved deck. Resume opens Direction with that deck. Start Fresh clears it and opens Deck Size. The deck is saved when a session starts.
- 2026-10-26: Set as Default can remove a list as the General Vocab or Gender default. The button stays available when a list is already the default for both.
- 2026-10-25: Build Your Own can add a new word from the word list. The word stays on that screen until the list is confirmed, then it is saved only in that pool. Add List is three cards again.
- 2026-10-25: Curated Lists hides a category when this language already has a curated list named for it, including numbered names like "People 2". Deleting that list brings the category back. Existing lists are left in place.
- 2026-10-25: New Word shows Noun, Verb, Adjective, and Adverb, with Noun selected. Gender mode no longer hides the other three. Splash now uses the Akuity symbol on white. A new TestFlight build is required for the splash.
- 2026-10-25: App icon now points at assets/akuity-icon-symbol-1024.png. Android adaptive background is white. A new TestFlight / EAS build is required before the icon shows on a device.
- 2026-10-20: Exit Study opens Choose What to Study with a Home link. The back chevron stays when that screen is opened from Home or after creating a list.
- 2026-10-20: Noun Production no longer shows the iOS Done bar. Flip and Submit still lift by the status-bar inset so they sit above the keyboard.
- 2026-10-20: Noun Production prompt word is large and centered again. Size 26, Plus Jakarta SemiBold, center. The sense label is centered too. The typing field is unchanged.
- 2026-10-18: Cleanup of leftover system type, #E0E0E0 borders, and the unused starter modal. Naming Confirm buttons and name fields match the designed screens.
- 2026-10-18: Session empty states, the error screen, the Home language sheet, and the Add New Word empty-list box now use the designed type and buttons. Shared button defaults match those screens; designed screens keep their own overrides.
- 2026-10-18: Word-management dialogs visual pass. Frequency and word-picker sheets copy the Set Default dialog. Slider labels use Add New Word’s chip type. Track colors unchanged.
- 2026-10-18: Add Existing Word visual pass. Header, search, chips, word rows, and Add to List copy Build Your Own. Vocab Bank empty line uses Plus Jakarta Regular 14. The paused-words rule uses the card divider color.
- 2026-10-18: Build Your Own visual pass. Header, rows, chips, search, and buttons copy Curated Lists, Vocab Bank, and Add New Word. SearchBar now carries the Vocab Bank search box. Text and selection rules unchanged.
- 2026-10-18: Select Study List visual pass. Header, rows, checkmarks, count, and Continue copy the Curated Lists screen. Text, selection, and navigation unchanged.
- 2026-10-18: Noun Production visual pass. Prompt, typing field, and revealed answer copy the relationship card’s prompt and answer-row styles. Text, validation, and behavior unchanged.
- 2026-10-17: Matching instruction is now "Tap a word, then tap its gender below".
- 2026-10-17: Gameplay visual pass. Matching (1001) and Relationship Judgment (1002) match the four Gameplay frames. Gender tiles are plain blocks in the official gender colors. Card behavior, scoring, and strings are unchanged.
- 2026-10-17: Stats follow-up. Words in Your Lists shows four words, then an amber View More pill that expands the rest in place. Weak has the line "Needs more practice".
- 2026-10-17: Stats visual pass. Matched Current and Lifetime, with data and empty, to the four Statistics frames (Lifetime with-data is node 9:1254). "Longest Streaks" and "1st Attempt" stay. Stats math and the opening tab are unchanged.
- 2026-10-15: Curly apostrophes in user-facing strings. Stats visual pass stopped: the with-data Lifetime frame is named "Stats - Lifetime Stats " (trailing space), not "Stats - Lifetime Stats".
- 2026-10-15: Get Started visual pass. Matched the welcome screen to Figma "Get Started". The personalize subtitle stays off. Name entry, the disabled rule, and navigation are unchanged.
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
