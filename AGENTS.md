# Repository Instructions

## Version and changelog

- For every product code change prepared for commit or release, increment the semantic version in `package.json`.
- Update `CHANGELOG.md` with the version, date, and user-facing changes in the same change set.
- Keep `package-lock.json`, `src/utils/version.js`, and the version badges in `README.md` and `README_EN.md` aligned with `package.json`.
- Use a patch increment by default. Use a minor or major increment when the scope requires it.
- Before deployment, confirm that the footer version matches the package version.
