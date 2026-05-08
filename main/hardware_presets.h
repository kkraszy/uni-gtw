#pragma once

#include <stddef.h>

#include "json.gen.h"

/* Resolved preset output is intentionally non-owning so callers can keep it on
 * the stack without a matching clear step. If this grows heap-managed fields,
 * all call sites must start clearing it before returning. */
typedef struct {
    struct hardware_config_t hardware;
} hardware_preset_resolved_t;

typedef struct {
    enum hardware_preset_t id;
    const char *name;
    const char *description;
    struct hardware_config_t hardware;
} hardware_preset_def_t;

const hardware_preset_def_t *hardware_preset_find(enum hardware_preset_t id);
const hardware_preset_def_t *hardware_presets_get_all(size_t *count);

void hardware_presets_resolve(hardware_preset_resolved_t *resolved,
                              const struct gateway_config_t *config);
