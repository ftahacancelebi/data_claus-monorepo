### Project Git Policy (gitPolicy.md)

This document defines the strict, concise version control and Issue tracking standards for [Project Name].

#### 1. Branching Strategy

- **Base Branch:** All new branches (`feature/*`, `fix/*`, etc.) **must always** be created from the `develop` branch (or `origin/develop`).
- **Integration Target:** Completed work should always target the `develop` branch via a Pull Request (PR).

#### 2. Issue Tracking Format

- **Issue Title:** Each Issue must be a **single-sentence statement** clearly defining the problem or task. (E.g., "Implement API integration for the user registration flow.")
- **Issue Body:** The body should briefly summarize the goal.

#### 3. Commit Message Format (Conventional & Single Sentence)

- **Format:** Adhere to the Conventional Commit Standard with a **strict single-sentence** rule for the summary.
- **Structure:** `<type>(<scope>): <single-sentence summary>`
- **Examples:**
  - `feat(auth): add google login button`
  - `fix(ui): resolve typo in dashboard header`
  - `refactor(db): optimize user query for performance`

#### 4. Pull Request (PR) Process and Format

- **PR Target:** PRs must be made into the `develop` branch.
- **PR Title:** The PR title must be a **single sentence**, either identical to the related Issue title or a clear, single-sentence summary of the work done.
- **PR Description:** The description should be minimal, primarily linking back to the relevant Issue number.
