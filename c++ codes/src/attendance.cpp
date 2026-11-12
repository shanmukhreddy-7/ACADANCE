#include "../include/academic_core.h"
#include "../include/engine_state.h"

namespace {
    int round_up_positive(double value) {
        const int whole = static_cast<int>(value);
        return whole + (value > whole ? 1 : 0);
    }

    bool valid_threshold(double threshold) {
        return acadence::is_finite(threshold) && threshold > 0 && threshold <= 100;
    }
}

double attendance(double present, double total) {
    if (!acadence::is_finite(present) || !acadence::is_finite(total)
        || present < 0 || total <= 0 || present > total) {
        return -1;
    }
    return present * 100.0 / total;
}

int can_skip(int present, int total, double threshold) {
    if (present < 0 || total <= 0 || present > total || !valid_threshold(threshold)) {
        return -1;
    }

    int extra_absences = static_cast<int>(present * 100.0 / threshold) - total;
    if (extra_absences < 0) {
        return 0;
    }

    // Compare exact counts at the boundary. A rounded 74.995% is not 75%.
    while (extra_absences > 0 && present * 100.0 < threshold * (total + extra_absences)) {
        --extra_absences;
    }
    return extra_absences;
}

int need_attend(int present, int total, double threshold) {
    if (present < 0 || total < 0 || present > total || !valid_threshold(threshold)) {
        return -1;
    }
    if (total == 0) {
        return 1; // One attended class establishes the first attendance percentage.
    }
    if (present * 100.0 >= total * threshold) {
        return 0;
    }
    if (threshold == 100) {
        return -2; // No finite number of future classes erases a past absence.
    }

    // Solve (present + x) / (total + x) >= threshold / 100 for x.
    const double required = (threshold * total - 100.0 * present) / (100.0 - threshold);
    return round_up_positive(required);
}
