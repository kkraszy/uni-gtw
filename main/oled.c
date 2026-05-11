#include "oled.h"

#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "driver/gpio.h"
#include "driver/i2c_master.h"
#include "esp_app_desc.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include "freertos/semphr.h"
#include "freertos/task.h"
#include "ssd1306.h"

#include "config.h"
#include "hardware_presets.h"

static const char *TAG = "oled";

#define OLED_TASK_STACK_SIZE 4096
#define OLED_TASK_PRIORITY   4
#define OLED_QUEUE_LEN       4
#define OLED_WAKE_US         (30ULL * 1000ULL * 1000ULL)

typedef enum {
    OLED_CMD_SHOW_BOOT = 1,
    OLED_CMD_SLEEP,
    OLED_CMD_STOP,
} oled_cmd_t;

typedef struct {
    struct hardware_config_t hw;
} oled_task_ctx_t;

static SemaphoreHandle_t  s_mutex = NULL;
static SemaphoreHandle_t  s_stop_sem = NULL;
static QueueHandle_t      s_queue = NULL;
static TaskHandle_t       s_task = NULL;
static esp_timer_handle_t s_sleep_timer = NULL;
static struct hardware_config_t s_active_hw;

static void resolve_hardware(struct hardware_config_t *out)
{
    hardware_preset_resolved_t resolved;

    config_lock();
    hardware_presets_resolve(&resolved, &g_config);
    config_unlock();

    *out = resolved.hardware;
}

static bool oled_hw_enabled(const struct hardware_config_t *hw)
{
    return hw->oled_enabled && hw->gpio_i2c_sda >= 0 && hw->gpio_i2c_scl >= 0;
}

static bool oled_hw_equal(const struct hardware_config_t *a,
                          const struct hardware_config_t *b)
{
    return a->oled_enabled == b->oled_enabled &&
           a->gpio_i2c_sda == b->gpio_i2c_sda &&
           a->gpio_i2c_scl == b->gpio_i2c_scl &&
           a->gpio_oled_power == b->gpio_oled_power &&
           a->gpio_oled_reset == b->gpio_oled_reset;
}

static void clear_stop_sem(void)
{
    while (xSemaphoreTake(s_stop_sem, 0) == pdTRUE) {
    }
}

static void sleep_timer_cb(void *arg)
{
    (void)arg;

    if (xSemaphoreTake(s_mutex, 0) != pdTRUE)
        return;

    QueueHandle_t queue = s_queue;
    xSemaphoreGive(s_mutex);

    if (!queue)
        return;

    oled_cmd_t cmd = OLED_CMD_SLEEP;
    (void)xQueueSend(queue, &cmd, 0);
}

static void restart_sleep_timer(void)
{
    if (!s_sleep_timer)
        return;

    esp_timer_stop(s_sleep_timer);
    esp_timer_start_once(s_sleep_timer, OLED_WAKE_US);
}

static void toggle_reset_gpio(int gpio)
{
    if (gpio < 0)
        return;

    gpio_config_t cfg = {
        .pin_bit_mask = 1ULL << gpio,
        .mode = GPIO_MODE_OUTPUT,
        .pull_up_en = GPIO_PULLUP_DISABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };
    if (gpio_config(&cfg) != ESP_OK)
        return;

    gpio_set_level(gpio, 1);
    vTaskDelay(pdMS_TO_TICKS(5));
    gpio_set_level(gpio, 0);
    vTaskDelay(pdMS_TO_TICKS(10));
    gpio_set_level(gpio, 1);
    vTaskDelay(pdMS_TO_TICKS(10));
}

static void set_power_gpio(int gpio, bool enabled)
{
    if (gpio < 0)
        return;

    gpio_config_t cfg = {
        .pin_bit_mask = 1ULL << gpio,
        .mode = GPIO_MODE_OUTPUT,
        .pull_up_en = GPIO_PULLUP_DISABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };
    if (gpio_config(&cfg) != ESP_OK)
        return;

    gpio_set_level(gpio, enabled ? 1 : 0);
}

static void render_boot_screen(ssd1306_handle_t panel)
{
    const esp_app_desc_t *app_desc = esp_app_get_description();
    char project[17];
    char version[17];
    char version_line[18];

    strlcpy(project, app_desc->project_name, sizeof(project));
    strlcpy(version, app_desc->version, sizeof(version));
    snprintf(version_line, sizeof(version_line), "v%s", version);

    esp_err_t ret = ssd1306_enable_display(panel);
    if (ret != ESP_OK) {
        ESP_LOGW(TAG, "ssd1306_enable_display failed: %s", esp_err_to_name(ret));
        return;
    }

    ret = ssd1306_clear_display(panel, false);
    if (ret != ESP_OK) {
        ESP_LOGW(TAG, "ssd1306_clear_display failed: %s", esp_err_to_name(ret));
        return;
    }

    ret = ssd1306_display_text(panel, 1, project, false);
    if (ret != ESP_OK) {
        ESP_LOGW(TAG, "ssd1306_display_text(project) failed: %s", esp_err_to_name(ret));
        return;
    }

    ret = ssd1306_display_text(panel, 3, version_line, false);
    if (ret != ESP_OK) {
        ESP_LOGW(TAG, "ssd1306_display_text(version) failed: %s", esp_err_to_name(ret));
        return;
    }

    restart_sleep_timer();
}

static void cleanup_display(ssd1306_handle_t panel,
                            i2c_master_bus_handle_t bus,
                            int power_gpio,
                            int reset_gpio)
{
    if (s_sleep_timer)
        esp_timer_stop(s_sleep_timer);

    if (panel) {
        esp_err_t ret = ssd1306_delete(panel);
        if (ret != ESP_OK)
            ESP_LOGW(TAG, "ssd1306_delete failed: %s", esp_err_to_name(ret));
    }

    if (bus) {
        esp_err_t ret = i2c_del_master_bus(bus);
        if (ret != ESP_OK)
            ESP_LOGW(TAG, "i2c_del_master_bus failed: %s", esp_err_to_name(ret));
    }

    if (power_gpio >= 0) {
        gpio_set_level(power_gpio, 0);
        gpio_reset_pin(power_gpio);
    }

    if (reset_gpio >= 0)
        gpio_reset_pin(reset_gpio);
}

static void oled_task(void *arg)
{
    oled_task_ctx_t *ctx = arg;
    const struct hardware_config_t hw = ctx->hw;
    QueueHandle_t queue;
    ssd1306_handle_t panel = NULL;
    i2c_master_bus_handle_t bus = NULL;
    esp_err_t ret;

    free(ctx);

    i2c_master_bus_config_t bus_cfg = {
        .i2c_port = -1,
        .sda_io_num = hw.gpio_i2c_sda,
        .scl_io_num = hw.gpio_i2c_scl,
        .clk_source = I2C_CLK_SRC_DEFAULT,
        .glitch_ignore_cnt = 7,
        .intr_priority = 0,
        .trans_queue_depth = 0,
        .flags = {
            .enable_internal_pullup = 1,
        },
    };
    ssd1306_config_t panel_cfg = I2C_SSD1306_128x64_CONFIG_DEFAULT;

    xSemaphoreTake(s_mutex, portMAX_DELAY);
    queue = s_queue;
    xSemaphoreGive(s_mutex);
    if (!queue)
        goto exit;

    set_power_gpio(hw.gpio_oled_power, true);
    vTaskDelay(pdMS_TO_TICKS(10));
    toggle_reset_gpio(hw.gpio_oled_reset);

    ESP_LOGI(TAG, "Initialising OLED I2C bus on SDA=%d SCL=%d power=%d reset=%d",
             hw.gpio_i2c_sda, hw.gpio_i2c_scl, hw.gpio_oled_power, hw.gpio_oled_reset);

    ret = i2c_new_master_bus(&bus_cfg, &bus);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "i2c_new_master_bus failed: %s", esp_err_to_name(ret));
        goto exit;
    }

    ret = ssd1306_init(bus, &panel_cfg, &panel);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "ssd1306_init failed: %s", esp_err_to_name(ret));
        goto exit;
    }

    ESP_LOGI(TAG, "OLED ready on SDA=%d SCL=%d power=%d reset=%d",
             hw.gpio_i2c_sda, hw.gpio_i2c_scl, hw.gpio_oled_power, hw.gpio_oled_reset);

    for (;;) {
        oled_cmd_t cmd;
        if (xQueueReceive(queue, &cmd, portMAX_DELAY) != pdTRUE)
            continue;

        switch (cmd) {
        case OLED_CMD_SHOW_BOOT:
            render_boot_screen(panel);
            break;
        case OLED_CMD_SLEEP:
            ret = ssd1306_disable_display(panel);
            if (ret != ESP_OK)
                ESP_LOGW(TAG, "ssd1306_disable_display failed: %s", esp_err_to_name(ret));
            break;
        case OLED_CMD_STOP:
            goto exit;
        }
    }

exit:
    cleanup_display(panel, bus, hw.gpio_oled_power, hw.gpio_oled_reset);

    xSemaphoreTake(s_mutex, portMAX_DELAY);
    if (s_queue) {
        vQueueDelete(s_queue);
        s_queue = NULL;
    }
    s_task = NULL;
    xSemaphoreGive(s_mutex);

    xSemaphoreGive(s_stop_sem);
    vTaskDelete(NULL);
}

static void stop_worker(void)
{
    QueueHandle_t queue;
    TaskHandle_t task;
    oled_cmd_t cmd = OLED_CMD_STOP;

    if (s_sleep_timer)
        esp_timer_stop(s_sleep_timer);

    xSemaphoreTake(s_mutex, portMAX_DELAY);
    queue = s_queue;
    task = s_task;
    xSemaphoreGive(s_mutex);

    if (!queue || !task)
        return;

    clear_stop_sem();
    if (xQueueSend(queue, &cmd, pdMS_TO_TICKS(100)) != pdTRUE) {
        ESP_LOGW(TAG, "Failed to queue OLED stop command");
        return;
    }

    if (xSemaphoreTake(s_stop_sem, pdMS_TO_TICKS(2000)) != pdTRUE)
        ESP_LOGW(TAG, "Timed out waiting for OLED task shutdown");
}

static void start_worker(const struct hardware_config_t *hw)
{
    oled_task_ctx_t *ctx = calloc(1, sizeof(*ctx));
    if (!ctx) {
        ESP_LOGE(TAG, "Failed to allocate OLED task context");
        return;
    }

    ctx->hw = *hw;

    xSemaphoreTake(s_mutex, portMAX_DELAY);
    s_queue = xQueueCreate(OLED_QUEUE_LEN, sizeof(oled_cmd_t));
    if (!s_queue) {
        xSemaphoreGive(s_mutex);
        free(ctx);
        ESP_LOGE(TAG, "Failed to create OLED queue");
        return;
    }

    if (xTaskCreate(oled_task, "oled_task", OLED_TASK_STACK_SIZE, ctx,
                    OLED_TASK_PRIORITY, &s_task) != pdPASS) {
        vQueueDelete(s_queue);
        s_queue = NULL;
        s_task = NULL;
        xSemaphoreGive(s_mutex);
        free(ctx);
        ESP_LOGE(TAG, "Failed to create OLED task");
        return;
    }

    xSemaphoreGive(s_mutex);
}

void oled_init(void)
{
    if (!s_mutex)
        s_mutex = xSemaphoreCreateMutex();
    if (!s_stop_sem)
        s_stop_sem = xSemaphoreCreateBinary();
    if (!s_sleep_timer) {
        esp_timer_create_args_t timer_args = {
            .callback = sleep_timer_cb,
            .name = "oled_sleep",
        };
        ESP_ERROR_CHECK(esp_timer_create(&timer_args, &s_sleep_timer));
    }

    resolve_hardware(&s_active_hw);
    if (!oled_hw_enabled(&s_active_hw)) {
        ESP_LOGI(TAG, "OLED disabled");
        return;
    }

    start_worker(&s_active_hw);
}

void oled_apply_config(void)
{
    struct hardware_config_t next_hw;

    resolve_hardware(&next_hw);
    if (oled_hw_equal(&next_hw, &s_active_hw))
        return;

    stop_worker();
    s_active_hw = next_hw;

    if (!oled_hw_enabled(&s_active_hw)) {
        ESP_LOGI(TAG, "OLED disabled after config update");
        return;
    }

    start_worker(&s_active_hw);
    oled_wake_boot_screen();
}

void oled_wake_boot_screen(void)
{
    QueueHandle_t queue;
    oled_cmd_t cmd = OLED_CMD_SHOW_BOOT;

    xSemaphoreTake(s_mutex, portMAX_DELAY);
    queue = s_queue;
    xSemaphoreGive(s_mutex);

    if (!queue)
        return;

    if (xQueueSend(queue, &cmd, pdMS_TO_TICKS(100)) != pdTRUE)
        ESP_LOGW(TAG, "Failed to queue OLED wake command");
}
