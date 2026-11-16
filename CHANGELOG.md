# Changelog

## 0.1.1 (alpha)

### Added
- Tag people in a comment with `@`: a picker lists the project's people, tags are highlighted in the posted comment.
- Notifications for being tagged in a comment or having a task assigned to you. They appear in a Notifications section above the tasks on both My tasks pages, with "Mark all as read", and opening a task clears its notifications.
- Red unread badge on the My tasks menu item (1 to 9, then 9+), refreshed every minute, on focus and after reading.
- Sortable column headers in the task list (number, title, status, priority, assignee, due date); click again to reverse. Sorting is done on the server so it applies to every page of results.
- Super admins can add and remove project members from the Admin console.
- "All projects" button in the project navbar.
- Task page redesign: click-to-edit title and description, fields in a sidebar, Comments and Activity as tabs with the comment box always in view, sticky back link, and a collapsible label picker that reuses the project's existing labels.
- Reusable `Collapsible`, `InlineEdit` and `IssueTabs` components.
- Test tooling: `scripts/e2e-loop.mjs` (161 end-to-end checks) with a manifest and `scripts/test-data-cleanup.mjs`, plus `check-notifications.mjs`, `check-ui.mjs` and browser scripts.

### Changed
- "Leave project" moved from the task page to Project Settings. Every project member can now open Project Settings; plain members see only the Leave section.
- Search has its own full-width line above the List/Board toggle and filters.
- Admin console: "+ Create user" now matches "+ New project", and the users table no longer runs columns together.

### Fixed
- After setting a new password the user stays on `/change-password`; they now land on their dashboard.

### Internal
- Notifications live in a per-project table that is created automatically on first use, so no manual database migration is needed for this release.
- Test and build warnings removed: Vitest config now uses native tsconfig paths (`vite-tsconfig-paths` dropped), the Node `DEP0190` warning in `scripts/with-local-db.mjs`, and expected error logs in tests are silenced and asserted.
- 482 tests, all passing: 456 unit and 26 database integration tests (0.0.1 had 411 and 13), including all 13 sort orders and notifications against a real database.

## 0.0.1 (alpha)

First tagged release: audit log, confirm dialogs, version footer, labels, CSV export, task numbering, activity trail.
