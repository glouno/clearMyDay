# ClearMyDay

Create a clean, personalized Sorbonne University calendar by selecting your master, modules, and TD/TME groups. ClearMyDay provides a subscription URL compatible with Apple Calendar, Google Calendar, Outlook, and other ICS clients.

**[Use ClearMyDay](https://www.clearmyday.com)** · **[Latest release](https://github.com/glouno/clearMyDay/releases/latest)**

## What it does

- Supports the MIND, AI2D, IMA, BIM, CCA, QI, RES, SAR, SESI, and STL tracks.
- Previews filtered events without creating a subscription.
- Preserves recurring events, exceptions, cancellations, and rescheduled sessions.
- Keeps Sorbonne CalDAV traffic efficient with Supabase and HTTP caching.

The Next.js application lives in [`clear-my-day/`](clear-my-day/). See its [technical README](clear-my-day/README.md) for local setup, architecture, and deployment instructions.

## Contributing

Start with [CONTRIBUTING.md](CONTRIBUTING.md), then browse the [open issues](https://github.com/glouno/clearMyDay/issues). Pull requests must pass CI and receive owner approval before they can reach production.

Useful references:

- [Calendar engine and caching](docs/calendar-engine.md)
- [Course catalog maintenance](docs/course-discovery.md)
- [Operations guide](docs/operations.md)
- [Troubleshooting](docs/troubleshooting.md)

Please report vulnerabilities privately as described in [SECURITY.md](SECURITY.md). Never publish calendar subscription URLs, credentials, logs, or user data.

Licensed under the [MIT License](LICENSE).
