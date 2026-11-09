# Contributing

Thank you for helping future Sorbonne students maintain ClearMyDay.

## Development

The application lives in `clear-my-day/` and requires Node.js 22 or newer.

```bash
cd clear-my-day
npm ci
npm test
npm run lint
npm run build
```

Copy environment variable names from `.env.example`; never commit real values,
calendar subscription URLs, production logs, or database exports.

`test/subscription-persistence-browser.js` is a synthetic rendered-UI journey.
Evaluate it in the local app through browser preview automation or Playwright's
`page.evaluate`. Use a credential-free server with outbound fetch blocked before
opening the page. The journey intercepts API calls and checks failed-save retry,
retained selections, durable success, and the temporary development warning.
It does not prove live Supabase or CalDAV operation.

## Pull requests

Create a branch or fork and open a pull request against `master`. Pull requests
must pass CI and be approved by the project owner before Vercel can deploy them
to production. Keep changes focused and add tests for calendar filtering,
recurrence, date-window, or cache behavior.

By contributing, you agree that your contribution is licensed under the MIT
License.
