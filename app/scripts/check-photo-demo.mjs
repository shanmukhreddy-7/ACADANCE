import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { defaultSeatPlan, seatRegion, comparePhotoPixels } from '../src/lib/photo-attendance.ts';
const { instance } = await WebAssembly.instantiate(await readFile('public/academic_core.wasm'), {});
const core = instance.exports;
const plan = defaultSeatPlan(
  Array.from({ length: 24 }, (_, i) => ({ id: String(i), name: String(i) })),
);
const empty = 'public/photo-demo/empty-classroom.png',
  occupied = 'public/photo-demo/occupied-classroom.png';
async function sample(file, region) {
  const { width, height } = await sharp(file).metadata();
  return sharp(file)
    .extract({
      left: Math.round(region.x * width),
      top: Math.round(region.y * height),
      width: Math.round(region.width * width),
      height: Math.round(region.height * height),
    })
    .resize(32, 32)
    .ensureAlpha()
    .raw()
    .toBuffer();
}
const full = { x: 0, y: 0, width: 1, height: 1 };
const shift = comparePhotoPixels(
  core,
  await sample(empty, full),
  await sample(occupied, full),
  36,
  0,
).shift;
let counts = { present: 0, absent: 0, review: 0 };
const expectedAbsent = [1, 10, 12, 21];
const mismatches = [];
for (let index = 0; index < 24; index++) {
  const region = seatRegion(plan, index);
  const result = comparePhotoPixels(
    core,
    await sample(empty, region),
    await sample(occupied, region),
    36,
    shift,
  );
  const state = core.photo_seat_state(result.fraction, 0.07, 0.22);
  const label = state === 1 ? 'present' : state === 0 ? 'absent' : 'review';
  counts[label]++;
  if (label !== (expectedAbsent.includes(index) ? 'absent' : 'present'))
    mismatches.push({ seat: index + 1, change: result.fraction, state: label });
}
console.log({ counts, shift, mismatches });
if (mismatches.length) process.exitCode = 1;
