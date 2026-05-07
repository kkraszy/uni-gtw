#include "prometheus.h"
#include "config.h"

#include <inttypes.h>
#include <stdatomic.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "esp_heap_caps.h"
#include "esp_http_server.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#if CONFIG_HEAP_TASK_TRACKING
#include "esp_heap_task_info.h"
#endif

static const char *TAG = "prometheus";

/* ── Radio / TX counters ─────────────────────────────────────────────────── */

static _Atomic uint32_t s_rx_total    = 0;
static _Atomic uint32_t s_rx_1way     = 0;
static _Atomic uint32_t s_rx_2way     = 0;
static _Atomic uint32_t s_rx_malformed = 0;
static _Atomic uint32_t s_tx_web      = 0;
static _Atomic uint32_t s_tx_mqtt     = 0;
static _Atomic uint32_t s_tx_auto     = 0;

void prometheus_inc_rx_total(void)    { atomic_fetch_add(&s_rx_total,     1); }
void prometheus_inc_rx_1way(void)     { atomic_fetch_add(&s_rx_1way,      1); }
void prometheus_inc_rx_2way(void)     { atomic_fetch_add(&s_rx_2way,      1); }
void prometheus_inc_rx_malformed(void){ atomic_fetch_add(&s_rx_malformed, 1); }
void prometheus_inc_tx_web(void)      { atomic_fetch_add(&s_tx_web,       1); }
void prometheus_inc_tx_mqtt(void)     { atomic_fetch_add(&s_tx_mqtt,      1); }
void prometheus_inc_tx_auto(void)     { atomic_fetch_add(&s_tx_auto,      1); }

/*
 * StaticTask_t.pxDummy8 == TCB_t.pxEndOfStack — verified by static asserts
 * in IDF's FreeRTOS port (freertos_tasks_c_additions.h and xtensa/port.c).
 * For Xtensa (stack grows hi→lo), pxEndOfStack is the highest stack address
 * (inclusive), so total allocation = pxEndOfStack - pxStackBase + 1 words.
 */
static uint32_t task_stack_total_bytes(const TaskStatus_t *t)
{
    const StackType_t *end = (const StackType_t *)((const StaticTask_t *)t->xHandle)->pxDummy8;
    return (uint32_t)(end - t->pxStackBase + 1) * sizeof(StackType_t);
}

static esp_err_t metrics_handler(httpd_req_t *req)
{
    config_lock();
    bool enabled = g_config.prometheus_enable;
    config_unlock();

    if (!enabled) {
        httpd_resp_send_err(req, HTTPD_404_NOT_FOUND, "Metrics disabled");
        return ESP_OK;
    }

    /* ── Uptime ──────────────────────────────────────────────────────────── */
    int64_t uptime_s = esp_timer_get_time() / 1000000;

    /* ── Heap globals ────────────────────────────────────────────────────── */
    size_t free_heap  = esp_get_free_heap_size();
    size_t min_free   = esp_get_minimum_free_heap_size();
    size_t total_heap = heap_caps_get_total_size(MALLOC_CAP_DEFAULT);
    size_t used_heap  = total_heap - free_heap;

    /* ── FreeRTOS task snapshot ──────────────────────────────────────────── */
    UBaseType_t num_tasks = uxTaskGetNumberOfTasks();
    TaskStatus_t *tasks   = malloc(sizeof(TaskStatus_t) * num_tasks);
    if (!tasks) {
        httpd_resp_send_err(req, HTTPD_500_INTERNAL_SERVER_ERROR, "OOM");
        return ESP_OK;
    }
    num_tasks = uxTaskGetSystemState(tasks, num_tasks, NULL);

    /* ── Per-task heap tracking ──────────────────────────────────────────── */
#if CONFIG_HEAP_TASK_TRACKING
    heap_all_tasks_stat_t htstat = {0};
    bool ht_ok = (heap_caps_alloc_all_task_stat_arrays(&htstat) == ESP_OK);
    if (ht_ok) heap_caps_get_all_task_stat(&htstat);
#endif

    /* ── Size and allocate output buffer ────────────────────────────────── */
    size_t buf_size = 1280                         /* uptime + heap globals + headers */
                    + (size_t)num_tasks * 160      /* stack metrics per task */
                    + 1024;                        /* radio/tx counters */
#if CONFIG_HEAP_TASK_TRACKING
    if (ht_ok) buf_size += 512 + htstat.task_count * 160; /* heap metrics per task */
#endif

    char *buf = malloc(buf_size);
    if (!buf) {
        free(tasks);
#if CONFIG_HEAP_TASK_TRACKING
        if (ht_ok) heap_caps_free_all_task_stat_arrays(&htstat);
#endif
        httpd_resp_send_err(req, HTTPD_500_INTERNAL_SERVER_ERROR, "OOM");
        return ESP_OK;
    }

    int pos = 0;

#define APPEND(...) \
    do { \
        int _n = snprintf(buf + pos, buf_size - (size_t)pos, __VA_ARGS__); \
        if (_n > 0) pos += _n; \
    } while (0)

    /* ── Uptime metric ───────────────────────────────────────────────────── */
    APPEND(
        "# HELP uni_gtw_uptime_seconds Seconds since boot\n"
        "# TYPE uni_gtw_uptime_seconds counter\n"
        "uni_gtw_uptime_seconds %" PRId64 "\n",
        uptime_s);

    /* ── Heap global metrics ─────────────────────────────────────────────── */
    APPEND(
        "# HELP uni_gtw_heap_free_bytes Current free heap bytes\n"
        "# TYPE uni_gtw_heap_free_bytes gauge\n"
        "uni_gtw_heap_free_bytes %zu\n"
        "# HELP uni_gtw_heap_total_bytes Total heap size in bytes\n"
        "# TYPE uni_gtw_heap_total_bytes gauge\n"
        "uni_gtw_heap_total_bytes %zu\n"
        "# HELP uni_gtw_heap_used_bytes Used heap bytes\n"
        "# TYPE uni_gtw_heap_used_bytes gauge\n"
        "uni_gtw_heap_used_bytes %zu\n"
        "# HELP uni_gtw_heap_min_free_bytes Minimum free heap ever (watermark)\n"
        "# TYPE uni_gtw_heap_min_free_bytes gauge\n"
        "uni_gtw_heap_min_free_bytes %zu\n",
        free_heap, total_heap, used_heap, min_free);

    /* ── Per-task stack metrics ──────────────────────────────────────────── */
    APPEND(
        "# HELP uni_gtw_task_stack_total_bytes Total allocated stack bytes per task\n"
        "# TYPE uni_gtw_task_stack_total_bytes gauge\n");
    for (UBaseType_t i = 0; i < num_tasks; i++) {
        APPEND("uni_gtw_task_stack_total_bytes{task=\"%s\"} %" PRIu32 "\n",
               tasks[i].pcTaskName, task_stack_total_bytes(&tasks[i]));
    }

    APPEND(
        "# HELP uni_gtw_task_stack_watermark_bytes Minimum free stack bytes ever per task\n"
        "# TYPE uni_gtw_task_stack_watermark_bytes gauge\n");
    for (UBaseType_t i = 0; i < num_tasks; i++) {
        uint32_t wm = (uint32_t)tasks[i].usStackHighWaterMark * sizeof(StackType_t);
        APPEND("uni_gtw_task_stack_watermark_bytes{task=\"%s\"} %" PRIu32 "\n",
               tasks[i].pcTaskName, wm);
    }

    free(tasks);

    /* ── Per-task heap metrics (CONFIG_HEAP_TASK_TRACKING) ───────────────── */
#if CONFIG_HEAP_TASK_TRACKING
    if (ht_ok) {
        APPEND(
            "# HELP uni_gtw_task_heap_current_bytes Current heap bytes allocated per task\n"
            "# TYPE uni_gtw_task_heap_current_bytes gauge\n");
        for (size_t i = 0; i < htstat.task_count; i++) {
            const task_stat_t *ts = &htstat.stat_arr[i];
            APPEND("uni_gtw_task_heap_current_bytes{task=\"%s\"} %zu\n",
                   ts->name, ts->overall_current_usage);
        }

        APPEND(
            "# HELP uni_gtw_task_heap_peak_bytes Peak heap bytes ever allocated per task\n"
            "# TYPE uni_gtw_task_heap_peak_bytes gauge\n");
        for (size_t i = 0; i < htstat.task_count; i++) {
            const task_stat_t *ts = &htstat.stat_arr[i];
            APPEND("uni_gtw_task_heap_peak_bytes{task=\"%s\"} %zu\n",
                   ts->name, ts->overall_peak_usage);
        }

        heap_caps_free_all_task_stat_arrays(&htstat);
    }
#endif

    /* ── Radio RX / TX counters ──────────────────────────────────────────── */
    uint32_t rx_total     = atomic_load(&s_rx_total);
    uint32_t rx_1way      = atomic_load(&s_rx_1way);
    uint32_t rx_2way      = atomic_load(&s_rx_2way);
    uint32_t rx_malformed = atomic_load(&s_rx_malformed);
    uint32_t tx_web       = atomic_load(&s_tx_web);
    uint32_t tx_mqtt      = atomic_load(&s_tx_mqtt);
    uint32_t tx_auto      = atomic_load(&s_tx_auto);

    APPEND(
        "# HELP uni_gtw_rx_packets_total Total received radio packets by protocol\n"
        "# TYPE uni_gtw_rx_packets_total counter\n"
        "uni_gtw_rx_packets_total{proto=\"1way\"} %" PRIu32 "\n"
        "uni_gtw_rx_packets_total{proto=\"2way\"} %" PRIu32 "\n"
        "# HELP uni_gtw_rx_malformed_packets_total Total received radio packets that failed to decode\n"
        "# TYPE uni_gtw_rx_malformed_packets_total counter\n"
        "uni_gtw_rx_malformed_packets_total %" PRIu32 "\n"
        "# HELP uni_gtw_rx_total_packets_total Total received radio packets (all)\n"
        "# TYPE uni_gtw_rx_total_packets_total counter\n"
        "uni_gtw_rx_total_packets_total %" PRIu32 "\n",
        rx_1way, rx_2way, rx_malformed, rx_total);

    APPEND(
        "# HELP uni_gtw_tx_commands_total Total TX commands sent by source\n"
        "# TYPE uni_gtw_tx_commands_total counter\n"
        "uni_gtw_tx_commands_total{source=\"web\"} %" PRIu32 "\n"
        "uni_gtw_tx_commands_total{source=\"mqtt\"} %" PRIu32 "\n"
        "uni_gtw_tx_commands_total{source=\"auto\"} %" PRIu32 "\n"
        "uni_gtw_tx_commands_total{source=\"all\"} %" PRIu32 "\n",
        tx_web, tx_mqtt, tx_auto, tx_web + tx_mqtt + tx_auto);

#undef APPEND

    httpd_resp_set_type(req, "text/plain; version=0.0.4; charset=utf-8");
    httpd_resp_send(req, buf, pos);
    free(buf);
    return ESP_OK;
}

void prometheus_init(httpd_handle_t server)
{
    static const httpd_uri_t uri = {
        .uri     = "/metrics",
        .method  = HTTP_GET,
        .handler = metrics_handler,
    };
    if (httpd_register_uri_handler(server, &uri) != ESP_OK)
        ESP_LOGW(TAG, "Failed to register /metrics handler");
}
