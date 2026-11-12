#include "../include/academic_core.h"
#include "../include/engine_state.h"

namespace {
    constexpr int maximum_pixels = 1024;
    double reference_pixels[maximum_pixels][3] = {};
    double current_pixels[maximum_pixels][3] = {};

    double absolute(double value) { return value < 0 ? -value : value; }
    bool valid_count(int count) { return count > 0 && count <= maximum_pixels; }
}

void photo_set_pixel(int index, int r1, int g1, int b1, int r2, int g2, int b2) {
    if (index < 0 || index >= maximum_pixels) return;
    const int values[] = {r1, g1, b1, r2, g2, b2};
    for (int channel = 0; channel < 3; ++channel) {
        reference_pixels[index][channel] = values[channel] < 0 ? 0 : values[channel] > 255 ? 255 : values[channel];
        current_pixels[index][channel] = values[channel + 3] < 0 ? 0 : values[channel + 3] > 255 ? 255 : values[channel + 3];
    }
}

// Sample the full frame first to estimate a uniform camera exposure change.
double photo_brightness_shift(int count) {
    if (!valid_count(count)) return 0;
    double difference = 0;
    for (int pixel = 0; pixel < count; ++pixel) {
        for (int channel = 0; channel < 3; ++channel) {
            difference += current_pixels[pixel][channel] - reference_pixels[pixel][channel];
        }
    }
    return difference / (count * 3.0);
}

double photo_changed_fraction(int count, double pixel_threshold, double brightness_shift) {
    if (!valid_count(count) || !acadence::is_finite(pixel_threshold)
        || pixel_threshold <= 0 || pixel_threshold > 255 || !acadence::is_finite(brightness_shift)) {
        return -1;
    }
    int changed = 0;
    for (int pixel = 0; pixel < count; ++pixel) {
        double difference = 0;
        for (int channel = 0; channel < 3; ++channel) {
            difference += absolute(current_pixels[pixel][channel] - reference_pixels[pixel][channel] - brightness_shift);
        }
        if (difference / 3.0 >= pixel_threshold) ++changed;
    }
    return changed / static_cast<double>(count);
}

// 0 = likely empty, 1 = likely occupied, 2 = needs review; -1 = invalid.
int photo_seat_state(double changed_fraction, double empty_threshold, double occupied_threshold) {
    if (!acadence::is_finite(changed_fraction) || !acadence::is_finite(empty_threshold)
        || !acadence::is_finite(occupied_threshold) || changed_fraction < 0 || changed_fraction > 1
        || empty_threshold < 0 || occupied_threshold > 1 || empty_threshold >= occupied_threshold) {
        return -1;
    }
    if (changed_fraction <= empty_threshold) return 0;
    if (changed_fraction >= occupied_threshold) return 1;
    return 2;
}
