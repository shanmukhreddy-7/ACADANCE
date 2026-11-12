#include <cassert>
#include <cmath>
#include "../include/academic_core.h"

namespace {
    void test_attendance_boundaries() {
        assert(can_skip(46, 48, 75) == 13);
        assert(can_skip(3, 4, 75) == 0);
        assert(need_attend(2, 4, 75) == 4);
        assert(need_attend(0, 0, 75) == 1);
        assert(attendance(0, 0) == -1);
        assert(need_attend(3, 4, 100) == -2);
        assert(attendance_scenario(25, 36, 8, 0, 0) == 75.0);
        assert(scenario_need_attend(25, 36, 0, 1, 0, 75) == 11);
        assert(attendance_scenario(3, 4, 0, 0, 2) == -1);
    }

    void test_marks_and_gpa() {
        assert(std::abs(convert_marks(36, 50, 15) - 10.8) < 0.0001);
        assert(convert_marks(51, 50, 15) == -1);
        assert(marks_needed(35, 50, 75) == 2.5);
        set_input(0, 10, 4);
        set_input(1, 8, 2);
        assert(std::abs(weighted_gpa(2) - 56.0 / 6.0) < 0.0001);
    }

    void test_photo_regions() {
        for (int i = 0; i < 100; ++i) photo_set_pixel(i, 100, 100, 100, 120, 120, 120);
        assert(photo_brightness_shift(100) == 20);
        assert(photo_changed_fraction(100, 10, 20) == 0);
        assert(photo_seat_state(0.04, 0.07, 0.22) == 0);
        assert(photo_seat_state(0.5, 0.07, 0.22) == 1);
        assert(photo_seat_state(0.15, 0.07, 0.22) == 2);
    }

    void test_team_sizes() {
        constexpr int students = 23;
        for (int i = 0; i < students; ++i) {
            set_input(i, 100 - i * 3, 1);
        }
        const int count = generate_teams(students, 5, 0);
        assert(count == 5);
        int sizes[5] = {};
        for (int i = 0; i < students; ++i) ++sizes[team_for(i)];
        for (int size : sizes) assert(size == 4 || size == 5);
    }
}

int main() {
    test_attendance_boundaries();
    test_marks_and_gpa();
    test_team_sizes();
    test_photo_regions();
    return 0;
}
