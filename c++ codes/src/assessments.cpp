#include "../include/academic_core.h"
#include "../include/engine_state.h"

namespace acadence {
    double scores[maximum_students] = {};
    double weights[maximum_students] = {};
}

double convert_marks(double score, double maximum, double weight) {
    if (!acadence::is_finite(score) || !acadence::is_finite(maximum)
        || !acadence::is_finite(weight) || maximum <= 0 || weight < 0
        || score < 0 || score > maximum) {
        return -1;
    }
    return score * weight / maximum;
}

double attendance_marks(double percentage, double weight) {
    if (!acadence::is_finite(percentage) || !acadence::is_finite(weight)
        || percentage < 0 || percentage > 100 || weight < 0) {
        return -1;
    }

    // Demo policy: award a visible fraction of the component's converted weight.
    if (percentage >= 95) return weight;
    if (percentage >= 90) return weight * 0.8;
    if (percentage >= 85) return weight * 0.6;
    if (percentage >= 80) return weight * 0.4;
    if (percentage >= 75) return weight * 0.2;
    return 0;
}

int performance_band(double percentage) {
    if (!acadence::is_finite(percentage) || percentage < 0 || percentage > 100) return -1;
    if (percentage >= 75) return 2;
    if (percentage >= 50) return 1;
    return 0;
}

void set_input(int index, double score, double weight) {
    if (index >= 0 && index < acadence::maximum_students) {
        acadence::scores[index] = score;
        acadence::weights[index] = weight;
    }
}

double sum_scores(int count) {
    if (count < 0 || count > acadence::maximum_students) return -1;
    double total = 0;
    for (int i = 0; i < count; ++i) {
        if (!acadence::is_finite(acadence::scores[i])) return -1;
        total += acadence::scores[i];
    }
    return total;
}

double best_scores(int count, int keep) {
    if (count < 0 || count > acadence::maximum_students || keep < 0 || keep > count) {
        return -1;
    }
    double sorted[acadence::maximum_students];
    for (int i = 0; i < count; ++i) sorted[i] = acadence::scores[i];

    // Insertion sort is sufficient for small assessment lists; source scores stay intact.
    for (int i = 1; i < count; ++i) {
        const double score = sorted[i];
        int position = i;
        while (position > 0 && sorted[position - 1] < score) {
            sorted[position] = sorted[position - 1];
            --position;
        }
        sorted[position] = score;
    }

    double total = 0;
    for (int i = 0; i < keep; ++i) total += sorted[i];
    return total;
}
