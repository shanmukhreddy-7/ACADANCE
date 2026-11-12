# Photo attendance — classroom presentation kit

This is an experimental fixed-seat occupancy prototype, not face recognition.
The supplied images are AI-generated illustrations of a fictional classroom.
They contain no real students or university records.

## Presentation order

1. Open Acadence → Professor → Load demo class → Photo attendance.
2. Choose a subject, date and period, then click **Load demo photos**.
3. Expand **Seating & alignment** to show the 4 × 6 roster order and sampling boxes. Row 1 is at the top; columns run left to right.
4. Click **Analyse photo**. The C++ WASM engine compares the actual image pixels.
5. The controlled pair drafts 20 present and four absent: R1C2, R2C5, R3C1 and R4C4 (roster positions 2, 11, 13 and 22).
6. Review every mark and demonstrate a correction if needed.
7. Click **Save attendance**, confirm your review and click **Confirm & save**.
8. The app opens **Attendance → Fetch details** for the selected day and period: present students left, absent students right. Reload and fetch the same period to demonstrate persistence.
9. Saving that subject/date/period again updates its existing register instead of adding a duplicate.

## What the program does

A fixed empty-room photo is the reference. Both photos must have the same viewpoint and aspect ratio.
The browser samples the calibrated seat regions. C++ estimates uniform brightness shift, measures the fraction of changed pixels, and classifies each region as likely occupied, likely empty or needs review.
The assigned seat then maps that region to a student. The program does not determine a person's identity.
Only the reviewed attendance and seating calibration are saved. Uploaded photos remain in browser memory and are discarded when the photo workflow is closed.

## Limits to explain honestly

The controlled generated pair passing is a demonstration, not a real-world accuracy benchmark.
Bags, shadows, an empty chair moved out of place, a different camera angle, different lighting, occlusion or a student sitting in the wrong seat can produce incorrect results.
A conventional front-of-class photo with overlapping rows is not suitable for this simple comparison method. Use a fixed, elevated camera with clearly visible seats and obtain the class's permission before photographing real students.
There is no trained person detector or face-recognition model in this prototype. Future work includes perspective calibration, robust person detection, occlusion handling and validation with consented real classroom photos.
Always review every mark before saving. No university attendance is submitted by the professor demo.

## Files

- empty-classroom.png — empty 4 × 6 reference
- occupied-classroom.png — the matching room with 20 fictional adults
- seating-order.csv — fictional demo roster in row-major order
- GENERATION_PROMPTS.md — image generation method and prompts
