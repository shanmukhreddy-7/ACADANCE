import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const compiler =
  process.env.CXX_WASM ||
  (process.env.WASI_SDK_PATH ? path.join(process.env.WASI_SDK_PATH, 'bin/clang++') : 'clang++');
const exports = [
  'attendance_scenario',
  'scenario_can_skip',
  'scenario_need_attend',
  'marks_needed',
  'photo_set_pixel',
  'photo_brightness_shift',
  'photo_changed_fraction',
  'photo_seat_state',
  'attendance',
  'can_skip',
  'need_attend',
  'convert_marks',
  'attendance_marks',
  'set_input',
  'weighted_gpa',
  'sum_scores',
  'best_scores',
  'performance_band',
  'generate_teams',
  'team_for',
];
const args = [
  '--target=wasm32',
  '-std=c++17',
  '-O3',
  '-nostdlib',
  '-fno-exceptions',
  '-fno-rtti',
  '-fno-builtin',
  '-Wl,--no-entry',
  ...exports.map((x) => '-Wl,--export=' + x),
  ...['attendance', 'assessments', 'gpa', 'teams', 'planning', 'photo_attendance'].map((name) =>
    path.join(root, 'c++ codes/src', name + '.cpp'),
  ),
  '-o',
  path.join(root, 'app/public/academic_core.wasm'),
];
const r = spawnSync(compiler, args, { stdio: 'inherit' });
if (r.error)
  console.error(
    'Set WASI_SDK_PATH to your extracted wasi-sdk directory. A prebuilt WASM module is included for normal app builds.',
  );
process.exit(r.status ?? 1);
