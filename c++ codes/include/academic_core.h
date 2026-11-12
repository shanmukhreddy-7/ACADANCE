#ifndef ACADENCE_ACADEMIC_CORE_H
#define ACADENCE_ACADEMIC_CORE_H

// C linkage makes these functions callable from JavaScript through WebAssembly.
// A negative result means that the requested calculation is unavailable or invalid.
extern "C" {
    double attendance(double present, double total);
    int can_skip(int present, int total, double threshold);
    int need_attend(int present, int total, double threshold);

    double attendance_scenario(int present, int total, int attended, int missed, int approved);
    int scenario_can_skip(int present, int total, int attended, int missed, int approved, double target);
    int scenario_need_attend(int present, int total, int attended, int missed, int approved, double target);
    double marks_needed(double score, double maximum, double target_percentage);

    void photo_set_pixel(int index, int r1, int g1, int b1, int r2, int g2, int b2);
    double photo_brightness_shift(int count);
    double photo_changed_fraction(int count, double pixel_threshold, double brightness_shift);
    int photo_seat_state(double changed_fraction, double empty_threshold, double occupied_threshold);

    double convert_marks(double score, double maximum, double weight);
    double attendance_marks(double percentage, double weight);
    int performance_band(double percentage);

    void set_input(int index, double score, double weight);
    double sum_scores(int count);
    double best_scores(int count, int keep);
    double weighted_gpa(int count);

    int generate_teams(int student_count, int preferred_size, int seed);
    int team_for(int student_index);
}

#endif
