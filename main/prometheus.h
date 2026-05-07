#pragma once
#include "esp_http_server.h"

void prometheus_init(httpd_handle_t server);

/* ── Radio / TX counters ─────────────────────────────────────────────────── */
void prometheus_inc_rx_total(void);
void prometheus_inc_rx_1way(void);
void prometheus_inc_rx_2way(void);
void prometheus_inc_rx_malformed(void);
void prometheus_inc_tx_web(void);
void prometheus_inc_tx_mqtt(void);
void prometheus_inc_tx_auto(void);
