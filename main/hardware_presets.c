#include "hardware_presets.h"

#ifdef CONFIG_IDF_TARGET_ESP32C3
static const hardware_preset_def_t s_presets[] = {
    {
        .id = hardware_preset_t_alufers_esp_cc1101_board,
        .name = "alufers esp-cc1101-board",
        .description = "ESP32-C3 board with a CC1101 radio module and a status LED.",
        .hardware = {
            .enabled = 1,
            .type = radio_type_t_cc1101,
            .gpio_miso = 7,
            .gpio_mosi = 10,
            .gpio_sck = 6,
            .gpio_csn = 4,
            .gpio_gdo0 = 5,
            .gpio_rst = -1,
            .gpio_busy = -1,
            .gpio_pa_enable = -1,
            .spi_freq_hz = 500000,
            .gpio_status_led = 9,
        },
    },
};
#elif defined(CONFIG_IDF_TARGET_ESP32S3)
static const hardware_preset_def_t s_presets[] = {
    {
        .id = hardware_preset_t_heltec_v4,
        .name = "Heltec WiFi LoRa 32 V4",
        .description = "Heltec's WiFi LoRa 32 ESP32-S3 board with OLED screen and SX1262 radio.",
        .hardware = {
            .enabled = 1,
            .type = radio_type_t_sx1262,
            .gpio_miso = 11,
            .gpio_mosi = 10,
            .gpio_sck = 9,
            .gpio_csn = 8,
            .gpio_gdo0 = 14,
            .gpio_rst = 12,
            .gpio_busy = 13,
            .gpio_pa_enable = 2,
            .spi_freq_hz = 500000,
            .gpio_status_led = 35,
        },
    },
    {
        .id = hardware_preset_t_xiao_esp32s3_wio_sx1262,
        .name = "XIAO ESP32S3 + Wio-SX1262",
        .description = "Seeed XIAO ESP32S3 with the Wio-SX1262 radio expansion board.",
        .hardware = {
            .enabled = 1,
            .type = radio_type_t_sx1262,
            .gpio_miso = 8,
            .gpio_mosi = 9,
            .gpio_sck = 7,
            .gpio_csn = 41,   /* NSS */
            .gpio_gdo0 = 39,  /* DIO1 */
            .gpio_rst = 42,
            .gpio_busy = 40,
            .gpio_pa_enable = -1,
            .spi_freq_hz = 500000,
            .gpio_status_led = 48,
        },
    },
};
#else
static const hardware_preset_def_t s_presets[] = {};
#endif

const hardware_preset_def_t *hardware_preset_find(enum hardware_preset_t id)
{
    size_t count = 0;
    const hardware_preset_def_t *presets = hardware_presets_get_all(&count);
    for (size_t i = 0; i < count; i++) {
        if (presets[i].id == id)
            return &presets[i];
    }
    return NULL;
}

const hardware_preset_def_t *hardware_presets_get_all(size_t *count)
{
    if (count)
        *count = sizeof(s_presets) / sizeof(s_presets[0]);
    return s_presets;
}

void hardware_presets_resolve(hardware_preset_resolved_t *resolved,
                              const struct gateway_config_t *config)
{
    hardware_config_t_init(&resolved->hardware);

    if (config->hardware_preset == hardware_preset_t_custom) {
        resolved->hardware = config->hardware;
        return;
    }

    const hardware_preset_def_t *preset = hardware_preset_find(config->hardware_preset);
    if (preset) {
        resolved->hardware = preset->hardware;
        return;
    }

    resolved->hardware = config->hardware;
}
