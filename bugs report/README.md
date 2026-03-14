# Bugs Report

This folder contains documentation of bugs found throughout the AI Canvas codebase.

## Bug Finding Process

### How It Works

1. **Bug Discovery**: Bugs are identified through code analysis, testing, or runtime observation
2. **Documentation**: Each bug is documented in its own Markdown file with:
   - **Title**: Clear description of the bug
   - **Location**: File path and line numbers where the bug exists
   - **Description**: What the bug is and how it manifests
   - **Why it's a bug**: Explanation of why this is problematic
   - **Approach 1**: First potential solution
   - **Approach 2**: Second potential solution
   - **Priority**: Severity assessment (High/Medium/Low)
3. **Review**: Bug reports are reviewed by a higher intelligence model
4. **Fix**: The master agent works on fixing the bugs based on priority

### Priority Guidelines

- **High**: Critical bugs that cause crashes, data loss, or completely break core functionality
- **Medium**: Bugs that cause significant issues but have workarounds
- **Low**: Minor bugs that don't significantly impact functionality

### Bug Report Index

| # | Bug Title | Priority | Status |
|---|-----------|----------|--------|
| 1 | [BR-001: setAppState Replaces Entire State Instead of Merging](BR-001-setAppState-Replaces-Entire-State.md) | Medium | Fixed ([resolution](BR-001-resolution.md)) |
| 2 | [BR-002: Double Type Casting Hides Type Errors](BR-002-Double-Type-Casting-Hides-Type-Errors.md) | Medium | Not Fixed ([resolution](BR-002-resolution.md)) |
| 3 | [BR-003: removeThread Has No Error Handling](BR-003-removeThread-No-Error-Handling.md) | Low | Not Fixed ([resolution](BR-003-resolution.md)) |
| 4 | [BR-004: Redundant Null Check in Roundness](BR-004-Redundant-Null-Check-in-Roundness.md) | Low | Not Fixed ([resolution](BR-004-resolution.md)) |
| 5 | [BR-005: setTimeout Without Cleanup in LexicalToolbar](BR-005-setTimeout-Without-Cleanup-LexicalToolbar.md) | Medium | Fixed ([resolution](BR-005-resolution.md)) |
| 6 | [BR-006: setTimeout Without Cleanup in AIChatArtifactPrimitives](BR-006-setTimeout-Without-Cleanup-AIChatArtifactPrimitives.md) | Medium | Fixed ([resolution](BR-006-resolution.md)) |
| 7 | [BR-007: Event Listeners Not Cleaned Up on Unmount in ImageComponent](BR-007-Event-Listeners-Not-Cleaned-Up-ImageComponent.md) | Medium | Identified |
| 8 | [BR-008: setTimeout Race Condition in CanvasPersistenceCoordinator](BR-008-setTimeout-Race-Condition-Persistence-Coordinator.md) | High | Identified |
| 9 | [BR-009: Event Listeners Not Cleaned Up on Unmount in WebEmbed](BR-009-Event-Listeners-Not-Cleaned-Up-WebEmbed.md) | Medium | Identified |

---

Additional planning:

- [BR-002 to BR-006 Triage Plan](BR-002-to-BR-006-triage-plan.md)

*This document is maintained by the bug finding agent. Updates will be made as new bugs are discovered and fixed or re-triaged.*
