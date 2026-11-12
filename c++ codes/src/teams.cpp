#include "../include/academic_core.h"
#include "../include/engine_state.h"

namespace {
    int assignments[acadence::maximum_students];
    int ranked_students[acadence::maximum_students];
    int team_sizes[acadence::maximum_students];
    double team_totals[acadence::maximum_students];
    int team_bands[acadence::maximum_students][3];
    bool allocated[acadence::maximum_students];
}

int generate_teams(int student_count, int preferred_size, int seed) {
    if (student_count < 1 || student_count > acadence::maximum_students
        || preferred_size < 2 || preferred_size > 20 || seed < 0) {
        return -1;
    }
    for (int i = 0; i < student_count; ++i) {
        if (!acadence::is_finite(acadence::scores[i]) || acadence::scores[i] < 0
            || acadence::scores[i] > 100) return -1;
    }

    const int team_count = (student_count + preferred_size - 1) / preferred_size;
    for (int i = 0; i < student_count; ++i) {
        ranked_students[i] = i;
        allocated[i] = false;
    }

    // Rank by normalized assessment score. Rotate equal-score ties on regeneration.
    for (int i = 1; i < student_count; ++i) {
        int position = i;
        while (position > 0) {
            const int current = ranked_students[position];
            const int previous = ranked_students[position - 1];
            const bool stronger = acadence::scores[current] > acadence::scores[previous];
            const bool tied_first = acadence::scores[current] == acadence::scores[previous]
                && (current + seed) % student_count < (previous + seed) % student_count;
            if (!stronger && !tied_first) break;
            ranked_students[position] = previous;
            ranked_students[position - 1] = current;
            --position;
        }
    }

    for (int team = 0; team < team_count; ++team) {
        team_sizes[team] = 0;
        team_totals[team] = 0;
        for (int band = 0; band < 3; ++band) team_bands[team][band] = 0;
    }
    const int base_size = student_count / team_count;
    const int extra_students = student_count % team_count;

    auto place_student = [&](int student, int team) {
        assignments[student] = team;
        allocated[student] = true;
        ++team_sizes[team];
        team_totals[team] += acadence::scores[student];
        ++team_bands[team][performance_band(acadence::scores[student])];
    };

    // Give each team a representative from each available performance band
    // before filling spare places. Scarce bands are distributed once per team
    // wherever possible; a band cannot be guaranteed when students run out.
    for (int band = 2; band >= 0; --band) {
        for (int rank = 0; rank < student_count; ++rank) {
            const int student = ranked_students[rank];
            if (allocated[student] || performance_band(acadence::scores[student]) != band) continue;
            int chosen_team = -1;
            for (int offset = 0; offset < team_count; ++offset) {
                const int team = (offset + seed) % team_count;
                const int capacity = base_size + (team < extra_students ? 1 : 0);
                if (team_sizes[team] >= capacity || team_bands[team][band] > 0) continue;
                if (chosen_team < 0 || team_totals[team] < team_totals[chosen_team]) {
                    chosen_team = team;
                }
            }
            if (chosen_team >= 0) place_student(student, chosen_team);
        }
    }

    // Fill the least-populated team first, then prefer the lowest total score.
    // Explicit capacities keep the final sizes within one student of each other.
    for (int i = 0; i < student_count; ++i) {
        if (allocated[ranked_students[i]]) continue;
        int chosen_team = -1;
        for (int offset = 0; offset < team_count; ++offset) {
            const int team = (offset + seed) % team_count;
            const int capacity = base_size + (team < extra_students ? 1 : 0);
            if (team_sizes[team] >= capacity) continue;

            if (chosen_team < 0 || team_sizes[team] < team_sizes[chosen_team]
                || (team_sizes[team] == team_sizes[chosen_team]
                    && team_totals[team] < team_totals[chosen_team])) {
                chosen_team = team;
            }
        }
        const int student = ranked_students[i];
        place_student(student, chosen_team);
    }
    // Refine the first draft with pair swaps. Keep each existing performance
    // band represented while bringing team averages closer together.
    for (int pass = 0; pass < 4; ++pass) {
        bool improved = false;
        for (int first = 0; first < student_count; ++first) {
            for (int second = first + 1; second < student_count; ++second) {
                const int a = assignments[first];
                const int b = assignments[second];
                if (a == b) continue;
                const int first_band = performance_band(acadence::scores[first]);
                const int second_band = performance_band(acadence::scores[second]);
                if (first_band != second_band
                    && (team_bands[a][first_band] <= 1 || team_bands[b][second_band] <= 1)) {
                    continue;
                }
                const double transfer = acadence::scores[second] - acadence::scores[first];
                const double before = team_totals[a] / team_sizes[a]
                    - team_totals[b] / team_sizes[b];
                const double after = (team_totals[a] + transfer) / team_sizes[a]
                    - (team_totals[b] - transfer) / team_sizes[b];
                if (after * after + 0.000001 >= before * before) continue;

                assignments[first] = b;
                assignments[second] = a;
                team_totals[a] += transfer;
                team_totals[b] -= transfer;
                --team_bands[a][first_band];
                ++team_bands[a][second_band];
                --team_bands[b][second_band];
                ++team_bands[b][first_band];
                improved = true;
            }
        }
        if (!improved) break;
    }
    return team_count;
}

int team_for(int student_index) {
    return student_index >= 0 && student_index < acadence::maximum_students
        ? assignments[student_index] : -1;
}
