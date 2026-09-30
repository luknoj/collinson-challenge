Always talk in ASD-STE100 Simplified Technical English.

## Git workflow
  1. Make a new branch from the latest `main`. Examples: `docs/<topic>`, `phase-<n>-<name>`.
  2. Commit with a Conventional Commits message. Example: `feat(docs): add implementation plan`. Put a short list of the changes in the commit body.
  3. Push the branch with `git push -u origin <branch>`.
  4. Open a pull request with `gh pr create`. Use the commit subject as the title. Use the list of changes from the commit body as the description.
- Merge a pull request only when the user asks. Use a merge commit. The message is the pull request title only:
  `gh pr merge <number> --merge --subject "<pull request title>" --body ""`
- After the merge, do not delete the branch. Update the local `main` with `git checkout main` and `git pull`.

## Code style

- A function with 2 or more parameters takes 1 object parameter. Destructure the object in the function signature.

  ```ts
  // Correct
  function windowIndices({ times, window, kind }: WindowIndicesInput): number[] {}
  windowIndices({ times, window, kind: 'instant' });

  // Incorrect
  function windowIndices(times: string[], window: TimeWindow, kind: ValueKind): number[] {}
  windowIndices(times, window, 'instant');
  ```

- Put optional values (for example, a config with a default value) in the same object.
- Exception: callbacks with a signature that an API sets. Examples: `Array.map`, `Array.sort`, `Array.reduce`, Vitest `it.each`.
