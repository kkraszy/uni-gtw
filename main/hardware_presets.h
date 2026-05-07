#pragma once

#include "json.gen.h"

/* Resolved preset output is intentionally non-owning so callers can keep it on
 * the stack without a matching clear step. If this grows heap-managed fields,
 * all call sites must start clearing it before returning. */
typedef struct {
    struct radio_config_t radio;
    int gpio_status_led;
} hardware_preset_resolved_t;

void hardware_presets_resolve(hardware_preset_resolved_t *resolved,
                              const struct gateway_config_t *config);
