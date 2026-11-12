import type { Core, SeatPlan, Student } from './types';
export type SeatResult = {
  index: number;
  student: string;
  fraction: number;
  status: 'present' | 'absent' | 'review';
};
export function defaultSeatPlan(students: Student[]): SeatPlan {
  const columns = 6,
    rows = Math.max(1, Math.min(10, Math.ceil(students.length / columns)));
  return {
    rows,
    columns,
    assignments: Array.from({ length: rows * columns }, (_, i) => students[i]?.id ?? ''),
    left: 0.025,
    top: 0.01,
    width: 0.95,
    height: 0.98,
    sampleWidth: 0.68,
    sampleHeight: 0.62,
    offsetY: 0.16,
  };
}
export function validateSeatPlan(plan: SeatPlan, students: Student[]) {
  if (
    !Number.isInteger(plan.rows) ||
    !Number.isInteger(plan.columns) ||
    plan.rows < 1 ||
    plan.columns < 1 ||
    plan.rows > 10 ||
    plan.columns > 10
  )
    throw Error('Choose 1–10 rows and columns.');
  if (!Array.isArray(plan.assignments) || plan.assignments.length !== plan.rows * plan.columns)
    throw Error('The seating grid is incomplete.');
  const assigned = plan.assignments.filter(Boolean);
  if (new Set(assigned).size !== assigned.length)
    throw Error('Assign each student to only one seat.');
  if (assigned.some((id) => !students.some((s) => s.id === id)))
    throw Error('The seating plan includes a student outside this class.');
  if (students.some((s) => !assigned.includes(s.id)))
    throw Error('Assign every student to a seat before saving attendance.');
  if (
    ![
      plan.left,
      plan.top,
      plan.width,
      plan.height,
      plan.sampleWidth,
      plan.sampleHeight,
      plan.offsetY,
    ].every(Number.isFinite) ||
    plan.left < 0 ||
    plan.top < 0 ||
    plan.width <= 0 ||
    plan.height <= 0 ||
    plan.left + plan.width > 1.001 ||
    plan.top + plan.height > 1.001 ||
    plan.sampleWidth <= 0 ||
    plan.sampleWidth > 1 ||
    plan.sampleHeight <= 0 ||
    plan.sampleHeight > 1 ||
    Math.abs(plan.offsetY) > 0.4
  )
    throw Error('Keep seat sampling boxes inside the photo.');
  for (let index = 0; index < plan.assignments.length; index++) {
    const r = seatRegion(plan, index);
    if (r.x < 0 || r.y < 0 || r.x + r.width > 1.001 || r.y + r.height > 1.001)
      throw Error('A seat region falls outside the photo. Reduce its size or vertical offset.');
  }
}
export function seatRegion(plan: SeatPlan, index: number) {
  const cellWidth = plan.width / plan.columns,
    cellHeight = plan.height / plan.rows;
  return {
    x: plan.left + (index % plan.columns) * cellWidth + ((1 - plan.sampleWidth) * cellWidth) / 2,
    y:
      plan.top +
      Math.floor(index / plan.columns) * cellHeight +
      ((1 - plan.sampleHeight) * cellHeight) / 2 +
      plan.offsetY * cellHeight,
    width: cellWidth * plan.sampleWidth,
    height: cellHeight * plan.sampleHeight,
  };
}
export function readPhoto(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      if (image.naturalWidth * image.naturalHeight > 24000000)
        reject(Error('Use a photo up to 24 megapixels.'));
      else resolve(image);
    };
    image.onerror = () => reject(Error('Could not read this image. Use JPEG, PNG or WebP.'));
    image.src = src;
  });
}
function sample(
  image: HTMLImageElement,
  region: { x: number; y: number; width: number; height: number },
) {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw Error('Image analysis is unavailable in this browser.');
  context.drawImage(
    image,
    region.x * image.naturalWidth,
    region.y * image.naturalHeight,
    region.width * image.naturalWidth,
    region.height * image.naturalHeight,
    0,
    0,
    32,
    32,
  );
  return context.getImageData(0, 0, 32, 32).data;
}
export function comparePhotoPixels(
  core: Core,
  reference: Uint8ClampedArray | Uint8Array,
  current: Uint8ClampedArray | Uint8Array,
  delta: number,
  shift: number,
) {
  if (
    reference.length !== current.length ||
    reference.length % 4 ||
    reference.length / 4 > 1024 ||
    !reference.length
  )
    throw Error('Invalid image sample.');
  for (let i = 0; i < reference.length / 4; i++) {
    const n = i * 4;
    core.photo_set_pixel(
      i,
      reference[n],
      reference[n + 1],
      reference[n + 2],
      current[n],
      current[n + 1],
      current[n + 2],
    );
  }
  return {
    fraction: core.photo_changed_fraction(reference.length / 4, delta, shift),
    shift: core.photo_brightness_shift(reference.length / 4),
  };
}
export async function analyzeSeatPhotos(
  core: Core,
  referenceSrc: string,
  currentSrc: string,
  plan: SeatPlan,
  delta = 36,
  occupied = 0.22,
) {
  const [reference, current] = await Promise.all([readPhoto(referenceSrc), readPhoto(currentSrc)]);
  if (
    Math.abs(
      reference.naturalWidth / reference.naturalHeight -
        current.naturalWidth / current.naturalHeight,
    ) > 0.025
  )
    throw Error('The two photos need the same aspect ratio and fixed camera position.');
  const full = { x: 0, y: 0, width: 1, height: 1 };
  const exposure = comparePhotoPixels(
    core,
    sample(reference, full),
    sample(current, full),
    delta,
    0,
  ).shift;
  const frameDifference = comparePhotoPixels(
    core,
    sample(reference, full),
    sample(current, full),
    delta,
    exposure,
  ).fraction;
  const unstable = frameDifference > 0.65 || Math.abs(exposure) > 50;
  const results: SeatResult[] = [];
  for (let index = 0; index < plan.assignments.length; index++) {
    const region = seatRegion(plan, index);
    const difference = comparePhotoPixels(
      core,
      sample(reference, region),
      sample(current, region),
      delta,
      exposure,
    );
    const state = unstable ? 2 : core.photo_seat_state(difference.fraction, 0.07, occupied);
    results.push({
      index,
      student: plan.assignments[index],
      fraction: difference.fraction,
      status: state === 1 ? 'present' : state === 0 ? 'absent' : 'review',
    });
  }
  return { results, unstable, exposure, frameDifference };
}

export function isSeatPlan(value: unknown): value is SeatPlan {
  try {
    const p = value as SeatPlan;
    if (!p || !Array.isArray(p.assignments) || !p.assignments.every((id) => typeof id === 'string'))
      return false;
    validateSeatPlan(
      p,
      p.assignments.filter(Boolean).map((id) => ({ id, name: id })),
    );
    return true;
  } catch {
    return false;
  }
}
