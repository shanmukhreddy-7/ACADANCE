# SRMAPI feature coverage

Compared against StoreVia/Srmap-Api revision `6f174f8e351cf9e1cf57a2e56e6d2ed4f1a73257`. This is functional coverage in Acadence's own interface, not a claim that its infrastructure or private data has been migrated.

| Reference feature | Acadence implementation | Data / operation limits |
| --- | --- | --- |
| Attendance, safe absences, recovery, future simulation | One Attendance page with subject cards, red shortages/recovery, configurable targets, inline bunk plans and a multi-date leave calendar; percentages and recovery run in C++ WASM | OD/ML scenario is explicit; university approval is not inferred. Selected future dates add missed timetable slots; unselected future classes are not assumed attended. Timetable cell counts may differ from actual combined sessions. |
| Daily attendance and history | Fetch today's recorded entries, save 30 daily snapshots per account and export CSV | Snapshots start when this app syncs. This cannot recover days the university endpoint does not expose. |
| Timetable and current class | Weekly table, course/faculty/room details, India-time current/next class updated every 30 seconds | Uses the loaded schedule; unannounced cancellations and make-up classes are unknown. |
| Internals, past internals and semester results | Compact subject totals with on-demand conducted/converted breakdowns; semester results in a separate tab with semester filtering and SGPA/CGPA; earlier-semester internals retained | Live endpoints require a valid portal session. |
| CGPA / SGPA and predictions | Published CGPA, credit-weighted SGPA and grade planner | C++ computes academic arithmetic. Programme-specific repeat rules still need official confirmation. |
| Profile / subjects | University academic identity, registered course credits and faculty details | Institution, programme/section, specialization, semester and provided birth/gender fields are read from the university profile. Unreturned fields remain absent. |
| Automatic sign-in verification | Credentials-only form; the server runs the supplied model and submits the login | Mocked orchestration and model graph tests pass. Live acceptance depends on the university and model. |
| Forgot password | Link to the university portal | The user completes the reset on the official portal. |
| Multi-account / remembered login | Saved accounts shortcut on every student page; switch among up to five accounts or add another. Selected identity is checked after sync. Encrypted HttpOnly session cookies | Expired sessions require sign-in again. New sessions last eight hours and do not save passwords; legacy explicitly remembered sessions expire normally. Credentials are not placed in browser local storage or database. |
| Auto refresh / offline | After-1-AM refresh while open, sync button, cached records, production service-worker shell | No unattended credential-bearing university scraping job. Install and open production app online first. |
| Academic calendar | Searchable odd/even calendar, holidays and CSV export | Bundled 2026–27 dates from reference, not a live official feed. |
| Faculty / ratings / timetable | Coming-soon page; backend plumbing retained for later work | Ratings and opt-in timetables belong to this installation. Original private ratings and schedules are unavailable. |
| Vacant classrooms | Coming-soon page; no current vacancy reports displayed | Reports unknown until enough users opt in. Even then, extra bookings may differ. |
| Resources / admin editor | Search by title/year/course/subject/type, publish links/files, edit, delete, PDF/image/text preview and downloads | New library starts empty. 2 MB upload limit. Download is available if a browser cannot preview a file. |
| Secure sharing | Removed from the student portal; legacy server/storage support retained | Encrypted local storage; MongoDB and private B2 required for hosted persistence/uploads. |
| Scheduled hard purging | Authenticated daily maintenance endpoint plus admin purge | Set `CRON_SECRET` and storage settings on Vercel. Local server: invoke maintenance from a local scheduler, or use admin purge. Expiry is enforced even before physical cleanup. |
| Chess | Removed from the student portal | Computer prefers captures; it is not Stockfish. Online state polls every 3 seconds instead of requiring the original separate server. |
| Typing test | Removed from the student portal | Personal best stays on this browser. |
| Random student chat | Removed from the student portal; legacy server/storage support retained | Requires two signed-in users on this installation; polls every 3 seconds; inactive rooms are purged. Administrators can read stored chat data with the server secret, so this is not end-to-end encryption. |
| Admin solver controls | Enable/disable optional solver and view request/suggestion counters | Original public standalone solver API and its IP block dashboard are not exposed. This app's solver serves its own login flow. |
| Reports | Student issue reports shown to this installation's administrator | Does not forward messages to the original project's maintainers. |
| Downloadable apps | Installable web app with manifest, icons and offline shell | Original Android/desktop signed binaries cannot be rebranded as ours. Native installers/app-store releases are not built. |

## Still requires external access

The reference's resource files, ratings, collected faculty timetables, storage credentials, native signing keys and production database are not in the public repository. Those datasets and accounts cannot be reproduced from source permission alone. This app provides its own functional replacements; no imported private dataset or deployed cloud service is claimed.

University-facing additions are mapped to the reference's endpoints and tested with synthetic HTML. A fresh user-led sign-in is required to verify past internals and daily attendance against the current live portal. Feedback, check-in and password changes must only be tested with the user's intended real submission; no test writes were made to university records.
