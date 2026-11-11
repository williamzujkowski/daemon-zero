## What and why

<!-- One or two sentences. Link the issue: Closes #N -->

## Milestone

<!-- M0..M6 and which checklist items this completes -->

## Verification

<!-- Paste the tail of `make verify`. State anything you could NOT run or verify. -->

```
```

## Checklist

- [ ] `make verify` passes with zero warnings
- [ ] New behaviour has tests; coverage thresholds still pass
- [ ] Content numbers changed? `make sim` passes and `docs/BALANCE.md` is updated
- [ ] `GameState` changed? `SCHEMA_VERSION` bumped and a migration added
- [ ] Docs updated
- [ ] No gate was weakened to get green (or it is called out above)
