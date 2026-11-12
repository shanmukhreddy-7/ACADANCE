# Academic calculation engine

The source is ordinary C++17. Each file has one responsibility, with descriptive names and brief comments for rules that need explanation.

- `attendance.cpp`: validates attendance counts, calculates percentages, and solves attendance planning inequalities.
- `photo_attendance.cpp`: compares bounded RGB samples, estimates exposure shift, measures changed pixels and classifies seat regions as empty, occupied or needing review. It does not identify faces or people.
- `planning.cpp`: validates future attended/missed slots and explicit approved-leave scenarios, calculates projected attendance and recovery, and compares marks against a chosen target.
- `assessments.cpp`: converts raw exam marks, applies the visible attendance mark policy, classifies descriptive score bands, and provides sums and best-of helpers.
- `gpa.cpp`: uses `sum(grade points × credits) / sum(credits)` for both SGPA and cumulative projections.
- `teams.cpp`: ranks normalized marks and distributes students while controlling team capacities and total scores. It aims for a balanced mix, not a guaranteed identical composition.

`academic_core.h` exposes the same functions to native tests and the WebAssembly adapter. The `extern "C"` declarations prevent C++ name mangling so JavaScript can call these functions by name.

Negative results indicate unavailable/invalid calculations. `need_attend` returns `-2` when a 100% target cannot be reached after a recorded absence. The interface translates these states into messages rather than showing misleading zeros.

The browser adapter supplies validated inputs; C++ still validates the core constraints. Data storage, network requests, table parsing, display formatting and UI interactions belong to the application folder. No credentials belong in this folder.

See the root README for native compilation, tests and WASM rebuild instructions.
