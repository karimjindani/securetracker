VERSION ALLOCATION

Before assigning a code version:

1. Run git fetch origin --prune.
2. Read the latest version from origin/main.
3. Inspect all active remote branches under origin/*.
4. Extract documentation versions allocated by those branches.
5. Determine the highest version across:
   - origin/main
   - all active unmerged remote branches
6. Assign the next patch version after the highest allocated version.
7. Never reuse a version already present on any remote branch.

Example:

origin/main      = v0.18.3
origin/feature-a = v0.18.4
origin/feature-b = v0.18.5

Next version = v0.18.6