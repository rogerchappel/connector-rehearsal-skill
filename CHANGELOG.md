# Changelog

## [Unreleased]

- Build distributable CLI files automatically during npm packaging and verify
  the extracted binary from a clean build.
- Distinguish literal dotted object keys from nested paths in before/after diffs.
- Return a failing CLI status from `render-approval` when rehearsal errors
  block approval, while retaining the redacted packet for diagnosis.
- Preserve nested YAML mappings, sequences, and scalars with standards-based
  parsing, and reject malformed YAML instead of silently rewriting it.
- Validate manifest field shapes before risk inference or artifact generation.
- Make the executable CRM YAML fixture a complete update example with payload.
- Add release-readiness checks for package metadata, pack contents, and CI verification.
