#include "hardware_presets.h"

static void resolve_custom(hardware_preset_resolved_t *resolved,
                           const struct gateway_config_t *config)
{
    radio_config_t_copy(&resolved->radio, &config->radio);
    resolved->gpio_status_led = config->gpio_status_led;
}

static void resolve_heltec_v4(hardware_preset_resolved_t *resolved,
                              const struct gateway_config_t *config)
{
    radio_config_t_copy(&resolved->radio, &config->radio);
    resolved->radio.enabled = 1;
    resolved->radio.type = radio_type_t_sx1262;
    resolved->radio.gpio_miso = 11;
    resolved->radio.gpio_mosi = 10;
    resolved->radio.gpio_sck = 9;
    resolved->radio.gpio_csn = 8;
    resolved->radio.gpio_gdo0 = 14;
    resolved->radio.gpio_rst = 12;
    resolved->radio.gpio_busy = 13;
    resolved->radio.gpio_pa_enable = 2;
    resolved->radio.spi_freq_hz = 500000;
    resolved->gpio_status_led = 35;
}

void hardware_presets_resolve(hardware_preset_resolved_t *resolved,
                              const struct gateway_config_t *config)
{
    radio_config_t_init(&resolved->radio);
    switch (config->hardware_preset) {
    case hardware_preset_t_heltec_v4:
        resolve_heltec_v4(resolved, config);
        break;
    case hardware_preset_t_custom:
    default:
        resolve_custom(resolved, config);
        break;
    }
}
