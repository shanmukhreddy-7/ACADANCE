#include "../include/academic_core.h"
#include "../include/engine_state.h"

double weighted_gpa(int count) {
    if (count <= 0 || count > acadence::maximum_students) return -1;

    double weighted_points = 0;
    double total_credits = 0;
    for (int i = 0; i < count; ++i) {
        const double points = acadence::scores[i];
        const double credits = acadence::weights[i];
        if (!acadence::is_finite(points) || !acadence::is_finite(credits)
            || points < 0 || points > 10 || credits < 0) {
            return -1;
        }
        weighted_points += points * credits;
        total_credits += credits;
    }

    // Zero-credit courses do not change the GPA denominator.
    return total_credits > 0 ? weighted_points / total_credits : -1;
}
