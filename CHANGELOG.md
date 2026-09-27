# Changelog

All notable changes to GitAgent will be documented here.

The project follows Keep a Changelog principles and will adopt semantic versioning when releases begin.

## [Unreleased]

### Added
- Initial GitAgent product definition.
- Repository-level AI agent contract.
- Architecture decision records.
- Development and governance documentation foundation.

### Changed
- None.

### Fixed
- None.

### Security
- None.
## Governed execution completion

- Inspect PR diffs with an independent model and bind review, human approval, security verification, and merge to the same commit.
- Run and record execution boundary checks automatically; reject duplicate execution starts and finalize configuration/policy failures.
- Scope task agents and operational mutations to repository owners; retire demo trust mutations.
- Preserve execution links after task-run errors and filter agents by the selected repository.
- Add a public non-sensitive dependency health probe and include execution-only workspace events in readiness.
- Refresh vulnerable development/transitive dependencies and add review, merge, lifecycle, and privilege regression coverage.
