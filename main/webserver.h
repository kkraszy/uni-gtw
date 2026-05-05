#pragma once

#include <stdint.h>
#include <stdbool.h>
#include "cosmo/cosmo.h"
#include "esp_http_server.h"

void webserver_early_init(void);
void webserver_start(void);
void webserver_start_status_timer(void);
void gtw_console_log(const char *fmt, ...);
void webserver_ws_broadcast_json(const char *json);
void webserver_ws_send_json_to_fd(int fd, const char *json);

/* Returns the running httpd handle (NULL before webserver_start). */
httpd_handle_t webserver_get_handle(void);

/* Returns true if the request passes the password check (always true if auth is disabled). */
bool webserver_check_auth(httpd_req_t *req);

/* Sends 401 and returns ESP_OK from the calling handler if auth fails. */
#define REQUIRE_AUTH(req)                                                       \
    do {                                                                        \
        if (!webserver_check_auth(req)) {                                       \
            httpd_resp_set_hdr(req, "WWW-Authenticate", "X-Auth");             \
            httpd_resp_send_err(req, HTTPD_401_UNAUTHORIZED, "Unauthorized");  \
            return ESP_OK;                                                      \
        }                                                                       \
    } while (0)

/**
 * Broadcast a packet_rx or packet_tx WebSocket message to all clients.
 * raw_bytes/raw_len: the raw CC1101 bytes before decoding.
 * valid: true if cosmo_decode succeeded.
 * pkt: decoded packet (ignored when valid=false).
 */
void webserver_ws_broadcast_packet(bool is_tx,
                                   const uint8_t *raw_bytes, int raw_len,
                                   bool valid, const cosmo_packet_t *pkt);
