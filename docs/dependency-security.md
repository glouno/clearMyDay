# Dependency security review

Reviewed on 21 October 2026. This records the locked dependency tree, not a guarantee that future advisories or updates are safe.

## Patched dependencies

- `next` and `eslint-config-next`: 15.5.28. This stays on Next.js 15 and includes the fixes for [GHSA-4jqv-mc3x-m676](https://github.com/advisories/GHSA-4jqv-mc3x-m676) and [GHSA-mcj8-r9mp-w47p](https://github.com/advisories/GHSA-mcj8-r9mp-w47p).
- `sharp`: 0.35.5, with its matching platform binaries and libvips packages, fixes [GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w). Next.js 15.5.28 accepts this version without an override.
- The earlier Vite 8.3.4 and source-map-js 1.2.2 security updates remain in the lockfile.

## Remaining development dependency: braces

[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) affects `braces` through 3.0.3. Deeply nested brace patterns can exhaust the JavaScript stack and terminate the process. The advisory lists no patched release as of this review.

The remaining paths are:

```text
eslint-config-next -> @next/eslint-plugin-next -> fast-glob -> micromatch -> braces
eslint-config-next -> @typescript-eslint/* -> typescript-estree -> fast-glob -> micromatch -> braces
```

The lockfile marks these packages as development dependencies. No application source imports these glob parsers directly; the identified consumers are lint tooling. Malicious patterns processed by that tooling can therefore still interrupt a development or CI process. This assessment does not claim the vulnerable package is fixed.

The full npm audit reports 10 high-severity package entries, all propagated from this one underlying advisory. `npm audit --omit=dev` reports zero vulnerabilities in the locked production dependency tree. Recheck both results when the dependency tree or advisory changes.

Keep untrusted code checks isolated in CI and do not pass user-provided patterns into this linting dependency chain. Update the parent packages when they remove the affected parser or adopt a patched release. Re-run the checks below before removing this note. Do not use `npm audit fix --force`: its suggested Next.js ESLint downgrade does not provide a patched `braces` release and would make the framework tooling inconsistent.

## Update and verification workflow

Dependabot groups production and development patch/minor updates separately. Major updates remain eligible for individual PRs, where their migrations can be reviewed independently. In particular, the earlier grouped updates mixed Next.js 16 and calendar-parser migrations, and introduced TypeScript 7 into tooling that did not support it.

From `clear-my-day/`, run:

```sh
npm ci
npm test
npm run lint
npm run build
npm audit --json
npm audit --omit=dev --json
npm ls braces --all
```

The full audit intentionally exits nonzero while the unpatched development finding remains. Before merging, require successful GitHub CI and a Vercel preview, and check calendar preview/generation. After deployment, confirm the production domain points to the reviewed commit and that the homepage and `/api/health` respond successfully.

For alerts whose package versions have already been patched, verify the default-branch lockfile and GitHub dependency graph. Do not dismiss alerts merely to make the dashboard empty; retain the distinction between a code fix and GitHub's reported alert state.
