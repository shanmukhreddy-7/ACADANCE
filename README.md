# Acadence

A local-first academic workspace with a professor demo and an SRM AP student portal connection. The interface uses a black background, blue actions, white text, bold readable type and restrained dimensional animation.

## Run in VS Code

Prerequisite: Node.js 22.18 or later (Node.js 24 LTS recommended).

Open this project folder in VS Code. In its terminal:

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). Choose **Professor** or **Student** on the welcome screen.

The root install command creates a private `app/.env.local` with a random session secret when the file is missing. An existing secret is preserved. If you install from inside `app` instead, copy `app/.env.example` to `app/.env.local` and set `SESSION_SECRET` as described there. Never commit this private file.

Normal app startup does not require a C++ compiler: the compiled WebAssembly engine is included. Its original, readable C++ source is under `c++ codes`.

## Two main folders

```text
c++ codes/
  include/academic_core.h    Public calculation interface
  include/engine_state.h     Bounded input buffers
  src/attendance.cpp        Percentages, safe absences and recovery
  src/assessments.cpp        Conversion, attendance marks and score helpers
  src/planning.cpp          Bunk scenarios, OD/ML projections and marks shortfalls
  src/photo_attendance.cpp  Pixel comparison, exposure correction and seat states
  src/gpa.cpp                Credit-weighted GPA
  src/teams.cpp              Balanced project allocation
  tests/core_tests.cpp       Native C++ checks
  CMakeLists.txt             Native build configuration
app/
  src/app/                   Welcome, shared-link pages and server API routes
  src/components/            Professor and student workspaces
  src/lib/                   Types, sample data, UI adapters and portal parsing
  src/server/                Encrypted sessions, shared storage, portal tools and model
  src/data/                  Faculty/calendar data and reference CAPTCHA model
  data/                      Private encrypted local runtime data (ignored by Git)
  public/academic_core.wasm  Compiled C++ engine used by the browser
  scripts/                   Rebuild and setup tools
  tests/                     WASM, parser, encryption and integration helper tests
  vercel.json                Vercel configuration
```

Root-level files are limited to workspace commands, documentation and ignore rules. All C++ source stays in `c++ codes`; all remaining application files stay in `app`.

## Professor demo

Choose **Load demo class** for 24 fictional students, three subjects and a fully marked Monday–Friday teaching week (15 registers), or start an empty register. The professor workspace has no university connection.

- Add students manually or import `Registration number,Name` CSV files. Download a template from Students & subjects.
- Add subjects with course codes and credits.
- Attendance → choose subject, date and period. Use **All present**, then mark individual absences, or mark each student Present/Absent. Save opens the saved register.
- **Fetch details** shows the selected date/period with present students on the left and absent students on the right. Previously recorded leave is labeled separately within the absent list. Existing periods, including legacy labels, remain available.
- Configure assessment components, original exam maximums and converted weights. Weights must add up to the internal total.
- Enter marks directly or paste a spreadsheet column. Blank marks stay pending; zero is a recorded zero. Attendance components calculate automatically.
- See component totals, attendance shortage, student detail and descriptive performance bands. The score is based on the assessed weight, not on unentered marks.
- Generate project teams from selected assessments; adjust assignments manually and export names without performance labels. Final team sizes differ by at most one before manual edits.
- Export class reports, back up the workspace as JSON, restore validated backups and review correction history.

Data is saved in this browser's local storage, separately from the student cache. It is not a shared or production university gradebook. Clearing browser data removes it; download a backup first.

The demo attendance mark bands are visible in Settings: 95%→100% of the attendance component, 90%→80%, 85%→60%, 80%→40%, 75%→20%, below 75%→0%. Approved leave counts as absence in the professor demo; cancelled sessions do not count.

## Experimental photo attendance

Professor → **Photo attendance**:

1. Choose the subject, date and period; upload an empty reference and a class photo, or load the demonstration pair.
2. Expand **Seating & alignment** only when the default roster order/grid needs adjustment.
3. **Analyse photo**, check each proposed mark and resolve any Review entries.
4. **Save attendance** → confirm the reviewed register. Saving opens Attendance → Fetch details for that exact date and period. Re-saving the same period updates it with an audit note instead of creating another register.

This is an occupancy-by-seating prototype, not face recognition or identity verification. It supports a regular grid up to 10 × 10. Camera movement, shadows, bags, occlusion and students changing seats can lead to wrong proposals. A clear elevated view and an empty reference are required; real classroom accuracy has not been benchmarked. Photos stay in the browser tab and are not sent to a server or written into the professor backup. Seating calibration and reviewed marks are saved locally.

The two built-in generated photos show 24 stations, 20 occupied and four empty (R1C2, R2C5, R3C1, R4C4). The image comparison test reads the actual PNG pixels; its passing result is for this controlled pair only. Download the [class demonstration kit](app/public/photo-demo/classroom-demo-kit.zip): both photos, a fictional seating-order CSV, presentation guide and generation prompts. Images were created with the built-in image generator and copied into `app/public/photo-demo`.

## Student portal

Choose **Student**. Enter only your registration number and password, then press **Enter workspace** (or Enter on the keyboard). The server creates a university session, runs the repository's verification model and submits the login. There is no verification field, image or checkbox on the sign-in form. If the portal/model cannot complete verification, the app gives a retry message. No guaranteed success rate is claimed.


- Attendance, current/past internals with individual CLA/mid/project/lab rows, weekly timetable, registered courses, university profile and results. Both conducted and converted component marks are preserved, including pending vs zero.
- Unified Attendance page: every subject's attendance, safe skips and recovery counts, red shortages, inline bunk scenarios and a top-right Absence planner calendar. Select separate future leave dates to see the projected percentages and recovery below the calendar. C++ computes the percentages, skip limits and recovery; unselected future classes are not assumed attended. Plans never change university records.
- Explicit OD/ML scenarios, marks target shortfalls, credit-weighted SGPA and grade projections. Published CGPA stays identified as published. The student overview now uses compact metrics and timetable/attendance summaries; full profile details remain under Profile & subjects.
- Daily attendance lookup, 30 daily snapshots per account, CSV exports and offline cached viewing.
- Academic calendar. Faculty Directory and Empty Classrooms are currently marked **Coming soon**, as requested.
- Study resources with search, file preview, downloads and administrator publishing/editing.
- Reviewed course feedback, attendance code submission using actual browser location, and user-led password reset.
- Five saved academic accounts, an after-1-AM refresh while open and an installable production web app.
- Installation administration for resources, faculty directory, solver settings/counters, reports, shared items and cleanup.

See [feature coverage and limits](app/FEATURE_COVERAGE.md) for the complete comparison. Shared campus tools require university sign-in. The original resource database and collected timetables are not part of the public repository: this installation starts with its own empty shared library. The underlying campus-data plumbing is retained for future work, but faculty and classroom availability are not presented as active features.

New sign-ins keep an AES-256-GCM encrypted HttpOnly upstream session cookie for up to eight hours and do not retain passwords. Cookies use Secure in production. Older explicitly remembered sessions may remain valid until sign-out or expiry. Academic caches in browser local storage are readable by anyone using that browser profile; clear them from Settings when needed.

The integration reads university HTML rather than an official API. Outages, portal changes and session restrictions can affect synchronization. **Sync now** shows the latest successful fetch; instant university updates are not guaranteed. Feedback/check-in require your review and confirmation. No real university writes were performed during automated checks.

Shared records and uploaded files are encrypted in `app/data` locally. Keep `SESSION_SECRET` unchanged and back up both that secret and the data directory: losing the secret makes existing records unreadable. Only one local app server should write to the same data directory. The local administrator is any signed-in user accessing the app through loopback (`localhost` or `127.0.0.1`); do not expose this mode as a public shared deployment.

## Production mode / installable app

Stop the development server first if port 3000 is already occupied:

```bash
npm run build
npm start
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). Open the app once online before offline viewing. Installation is offered by supported browsers on localhost or deployed HTTPS; on iPhone use Safari → Share → Add to Home Screen. Development mode intentionally does not register the service worker.

## Deploy to Vercel

1. Put the project in your Git repository and import it into Vercel.
2. **Set Root Directory to `app`.** Select the Next.js framework preset.
3. Add `SESSION_SECRET` in Vercel environment settings, using a fresh random value of at least 32 characters. Do not use the example placeholder.
4. Build command: `npm run build`. Install command: `npm ci`. Output: Next.js default.
5. Deploy. The included precompiled WASM runs in the browser; Vercel does not need a native C++ process or compiler.
6. Verify portal login on the deployed origin. Upstream university access from Vercel's network must be tested; a local build cannot guarantee it.

For persistent shared tools on Vercel, also configure:

| Variable | Purpose |
| --- | --- |
| `MONGO_URI` | MongoDB URI for encrypted shared metadata; database `acadence` is created on first write |
| `ADMIN_REGISTRATIONS` | Comma-separated registration numbers permitted to administer campus tools |
| `B2_BUCKET`, `B2_ENDPOINT`, `B2_REGION`, `B2_KEY_ID`, `B2_APP_KEY` | Private S3-compatible Backblaze bucket for encrypted uploads |
| `CRON_SECRET` | Bearer secret for scheduled cleanup; daily at 20:00 UTC / 01:30 IST |

Only the portal and professor features work without these hosted shared-storage settings. The app reports missing configuration instead of writing files to Vercel's temporary filesystem. No cloud account, database, bucket or deployment was provisioned automatically.

Do not deploy as a static export: the student portal connection needs the server API route. No deployment has been created automatically.

## Checks

```bash
npm test
npm --prefix app run typecheck
npm run build
```

Native C++ checks, with CMake and a C++17 compiler:

```bash
cmake -S "c++ codes" -B "c++ codes/build"
cmake --build "c++ codes/build"
ctest --test-dir "c++ codes/build" --output-on-failure
```

Or compile directly:

```bash
g++ -std=c++17 "c++ codes/src/attendance.cpp" "c++ codes/src/assessments.cpp" "c++ codes/src/gpa.cpp" "c++ codes/src/teams.cpp" "c++ codes/src/planning.cpp" "c++ codes/src/photo_attendance.cpp" "c++ codes/tests/core_tests.cpp" -o acadence-core-tests
./acadence-core-tests
```

To rebuild WebAssembly after editing C++, install the official [WASI SDK](https://github.com/WebAssembly/wasi-sdk/releases), then:

```bash
WASI_SDK_PATH=/absolute/path/to/wasi-sdk npm run core:build
npm test
```

PowerShell: set `$env:WASI_SDK_PATH` first, then run `npm run core:build`. The compiler emits `app/public/academic_core.wasm`; include the rebuilt artifact in the repository before deploying.

For local shared-tool integration checks, keep a production server on port 3001, then run `node scripts/verify-community.mjs` from `app`. It uses synthetic accounts and never sends university requests. Use a development/test data directory for these checks.

## Attribution

Portal table mappings and extraction ideas are adapted from [StoreVia/Srmap-Api](https://github.com/StoreVia/Srmap-Api), with owner permission as confirmed by the requester. See `app/THIRD_PARTY_NOTICES.md`. This implementation has its own UI, C++ engine and authentication design.
