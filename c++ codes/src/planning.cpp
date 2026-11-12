#include "../include/academic_core.h"
#include "../include/engine_state.h"

namespace {
    constexpr int maximum_slots = 1000000;

    bool scenario_counts(int present, int total, int attended, int missed,
                         int approved, int& next_present, int& next_total) {
        if (present < 0 || total < 0 || present > total || attended < 0
            || missed < 0 || approved < 0 || approved > total - present
            || total > maximum_slots || attended > maximum_slots
            || missed > maximum_slots) {
            return false;
        }
        next_present = present + approved + attended;
        next_total = total + attended + missed;
        return true;
    }
}

// Approved OD/ML is an explicit planning input, never an assumed portal update.
double attendance_scenario(int present, int total, int attended, int missed, int approved) {
    int next_present = 0;
    int next_total = 0;
    if (!scenario_counts(present, total, attended, missed, approved, next_present, next_total)) {
        return -1;
    }
    return attendance(next_present, next_total);
}

int scenario_can_skip(int present, int total, int attended, int missed,
                      int approved, double target) {
    int next_present = 0;
    int next_total = 0;
    if (!scenario_counts(present, total, attended, missed, approved, next_present, next_total)) {
        return -1;
    }
    return can_skip(next_present, next_total, target);
}

int scenario_need_attend(int present, int total, int attended, int missed,
                         int approved, double target) {
    int next_present = 0;
    int next_total = 0;
    if (!scenario_counts(present, total, attended, missed, approved, next_present, next_total)) {
        return -1;
    }
    return need_attend(next_present, next_total, target);
}

double marks_needed(double score, double maximum, double target_percentage) {
    if (!acadence::is_finite(score) || !acadence::is_finite(maximum)
        || !acadence::is_finite(target_percentage) || maximum <= 0
        || score < 0 || score > maximum || target_percentage < 0
        || target_percentage > 100) {
        return -1;
    }
    const double shortage = maximum * target_percentage / 100.0 - score;
    return shortage > 0 ? shortage : 0;
}
