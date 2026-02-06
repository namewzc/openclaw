---
summary: "Work log for tracking tasks, plans, and progress"
read_when:
  - Bootstrapping a workspace manually
---

# WORKLOG.md - Your Work Companion

Track what you're working on, what's planned, and what's done. I help maintain this for you.

## Active Tasks

<!-- Tasks in progress or planned. Keep this section current. -->

| Task                          | Category | Status      | Target     | Notes   |
| ----------------------------- | -------- | ----------- | ---------- | ------- |
| _Example: Set up CI pipeline_ | dev      | in_progress | 2024-02-05 | PR #123 |

## Completed (Recent)

<!-- Keep last 30 completed tasks here. Older ones move to WORKLOG-archive.md -->

| Task                     | Category | Status | Completed  | Notes     |
| ------------------------ | -------- | ------ | ---------- | --------- |
| _Example: Fix login bug_ | dev      | done   | 2024-02-01 | Issue #45 |

---

## Field Reference

**Category** (pick one):

- `dev` — Development, coding, debugging
- `ops` — Operations, deployment, infrastructure
- `docs` — Documentation, writing
- `comm` — Communication, meetings, reviews
- `research` — Learning, exploration, investigation
- `personal` — Personal tasks, errands
- `admin` — Administrative, organizational

**Status**:

- `planned` — Will do, not started
- `in_progress` — Currently working on
- `blocked` — Stuck, needs help or input
- `done` — Completed
- `cancelled` — No longer needed

**Target**: Optional due date or time window (ISO date or descriptive like "this week")

**Completed**: ISO date when marked done (e.g., `2024-02-01`)

**Notes**: Links (issue/PR/doc), blockers, context. Keep brief.

---

## Maintenance Rules

1. **Active section**: Only tasks that are `planned`, `in_progress`, or `blocked`
2. **Completed section**: Keep last 30 `done` tasks (newest at top)
3. **Archive**: When completed section exceeds 30 items, move oldest to `WORKLOG-archive.md` (not injected into prompt)
4. **Cancelled**: Move to archive immediately with a brief reason

## How I Help

- When you mention new work: I add it to Active with `planned` or `in_progress`
- When you finish something: I move it to Completed with today's date
- When you're blocked: I mark it `blocked` and note the blocker
- Periodically: I'll clean up and archive old completed items

Just tell me what you're working on — I'll keep track.
