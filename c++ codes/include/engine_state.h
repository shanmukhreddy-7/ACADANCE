#ifndef ACADENCE_ENGINE_STATE_H
#define ACADENCE_ENGINE_STATE_H

namespace acadence {
    // The demo intentionally caps classes at 1,000 students.
    constexpr int maximum_students = 1000;
    extern double scores[maximum_students];
    extern double weights[maximum_students];

    inline bool is_finite(double value) {
        return __builtin_isfinite(value);
    }
}

#endif
