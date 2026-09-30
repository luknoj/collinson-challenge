Always talk in ASD-STE100 Simplified Technical English.

## Git workflow
  1. Make a new branch from the latest `main`. Examples: `docs/<topic>`, `phase-<n>-<name>`.
  2. Commit with a Conventional Commits message. Example: `feat(docs): add implementation plan`. Put a short list of the changes in the commit body.
  3. Push the branch with `git push -u origin <branch>`.
  4. Open a pull request with `gh pr create`. Use the commit subject as the title. Use the list of changes from the commit body as the description.
- Merge a pull request only when the user asks. Use a merge commit. The message is the pull request title only:
  `gh pr merge <number> --merge --subject "<pull request title>" --body ""`
- After the merge, do not delete the branch. Update the local `main` with `git checkout main` and `git pull`.
