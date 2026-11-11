# Reference: earlier draft

This folder is the earlier AI-assisted design conversation and the UI code it produced. It is kept as prior art. **It is not a specification and must not be copied into `src/`.**

- `full-transcript.txt` - the whole conversation (about 290 KB). Search it; do not load it whole.
- `ui/*.tsx.txt` - React Native components from the draft: terminal screen, sensor widgets, dilemma modal, Other Minds console, corporate tab.
- `engine/*.ts.txt` - the draft's storage adapter and game-loop hook.

Files end in `.txt` so the compiler, linter and bundler ignore them.

## What is worth borrowing

- Visual language: palette, monospace styling, ASCII meters, bracketed button labels, the red interrupt banner on the dilemma modal.
- Layout: three columns on wide screens, tabs plus a log drawer on phones.
- Copy and flavour text.
- The storage adapter's platform split (AsyncStorage on native, localStorage on web).

## What must not be reused

- The store (`useGameStore`) and every call to it. The components read fields and call actions that do not exist in the current engine.
- Hardcoded content: node ids, faction logic, corporate actions, widget `if` chains, inline dilemma and chatter data. All of this is data now.
- The numbers. The draft's economy could not be completed (see `docs/REVIEW-FINDINGS.md`).
- Dependency versions and tool configuration.

When rebuilding a component, start from `docs/UI-SPEC.md` and the engine API in `src/engine/index.ts`, and use these files only as a visual reference.
