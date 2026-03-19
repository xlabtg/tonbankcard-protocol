# Future Test Cases

This directory contains placeholder test specifications for protocol features that are planned but not yet implemented.

## Purpose

These files serve as:
1. **Specifications** — Define the expected behavior before implementation
2. **Tracking** — Record what needs to be tested when features land
3. **Documentation** — Link to threat model entries and design docs

All tests in this directory use `describe.skip` and will not run in CI until the underlying feature is implemented.

## Contents

| File | Threat | Feature Dependency |
|------|--------|--------------------|
| [oracle-manipulation.spec.ts](oracle-manipulation.spec.ts) | T7 — Oracle Price Manipulation | Lending adapter contracts |

## Adding New Placeholders

When documenting a future test scenario:
1. Create a `.spec.ts` file with `describe.skip`
2. Add detailed comments referencing the threat model entry and relevant docs
3. Add an entry to this README table
4. Reference the file from the relevant threat model section

## Activating Tests

When a feature is implemented:
1. Remove the `.skip` from `describe.skip`
2. Implement the test bodies
3. Move the file to the appropriate active test directory (e.g., `tests/adversarial/`)
4. Update the threat model reference to remove the `(placeholder)` note
