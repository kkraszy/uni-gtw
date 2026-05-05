#include "ota.h"
#include "config.h"
#include "mqtt.h"
#include "radio.h"
#include "webserver.h"

#include <string.h>
#include <stdlib.h>

#include "esp_app_desc.h"
#include "esp_crt_bundle.h"
#include "esp_err.h"
#include "esp_http_client.h"
#include "esp_https_ota.h"
#include "esp_log.h"
#include "esp_ota_ops.h"
#include "esp_system.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#include "json.gen.h"

static const char *TAG = "ota";

#define GITHUB_API_URL  "https://api.github.com/repos/alufers/uni-gtw/releases/latest"
#define GITHUB_RESP_MAX 16384

#define REQUIRE_AUTH(req)                                                       \
    do {                                                                        \
        if (!webserver_check_auth(req)) {                                       \
            httpd_resp_set_hdr(req, "WWW-Authenticate", "X-Auth");             \
            httpd_resp_send_err(req, HTTPD_401_UNAUTHORIZED, "Unauthorized");  \
            return ESP_OK;                                                      \
        }                                                                       \
    } while (0)

static volatile bool s_ota_in_progress = false;

/* ── WS helpers ─────────────────────────────────────────────────────────── */

static void broadcast_ota_progress(const char *status, int progress, const char *error)
{
    struct ws_server_message_t msg;
    ws_server_message_t_init(&msg);
    msg.tag = ws_server_message_t_ota_progress;
    msg.value.ota_progress.payload.status = sstr(status);
    if (progress >= 0) {
        msg.value.ota_progress.payload.has_progress = 1;
        msg.value.ota_progress.payload.progress = progress;
    }
    if (error) {
        msg.value.ota_progress.payload.has_error = 1;
        msg.value.ota_progress.payload.error = sstr(error);
    }
    sstr_t out = sstr_new();
    json_marshal_ws_server_message_t(&msg, out);
    ws_server_message_t_clear(&msg);
    webserver_ws_broadcast_json(sstr_cstr(out));
    sstr_free(out);
}

/* ── GitHub API fetch ────────────────────────────────────────────────────── */

static esp_err_t fetch_github_release(struct github_release_t *out)
{
    esp_http_client_config_t cfg = {
        .url               = GITHUB_API_URL,
        .crt_bundle_attach = esp_crt_bundle_attach,
        .method            = HTTP_METHOD_GET,
        .buffer_size       = 2048,
        .buffer_size_tx    = 512,
        .timeout_ms        = 10000,
    };

    esp_http_client_handle_t client = esp_http_client_init(&cfg);
    if (!client) return ESP_ERR_NO_MEM;

    esp_http_client_set_header(client, "User-Agent", "uni-gtw-firmware");
    esp_http_client_set_header(client, "Accept", "application/vnd.github+json");

    esp_err_t err = esp_http_client_open(client, 0);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "HTTP open failed: %s", esp_err_to_name(err));
        esp_http_client_cleanup(client);
        return err;
    }

    int content_length = esp_http_client_fetch_headers(client);
    int buf_size = (content_length > 0 && content_length < GITHUB_RESP_MAX)
                   ? content_length : GITHUB_RESP_MAX;

    char *buf = malloc(buf_size + 1);
    if (!buf) {
        esp_http_client_close(client);
        esp_http_client_cleanup(client);
        return ESP_ERR_NO_MEM;
    }

    int data_read = esp_http_client_read_response(client, buf, buf_size);
    esp_http_client_close(client);
    esp_http_client_cleanup(client);

    if (data_read < 0) {
        free(buf);
        return ESP_FAIL;
    }
    buf[data_read] = '\0';

    sstr_t json = sstr_of(buf, (size_t)data_read);
    int rc = json_unmarshal_github_release_t(json, out);
    sstr_free(json);
    free(buf);
    return (rc == 0) ? ESP_OK : ESP_FAIL;
}

/* ── /api/ota/check ──────────────────────────────────────────────────────── */

static esp_err_t ota_check_handler(httpd_req_t *req)
{
    REQUIRE_AUTH(req);

    const esp_app_desc_t *app_desc = esp_app_get_description();

    struct github_release_t release;
    github_release_t_init(&release);
    esp_err_t err = fetch_github_release(&release);

    struct ota_check_response_t resp;
    ota_check_response_t_init(&resp);
    resp.current_version = sstr(app_desc->version);

    if (err != ESP_OK || release.prerelease) {
        resp.update_available = false;
        github_release_t_clear(&release);
    } else {
        const char *tag = sstr_cstr(release.tag_name);
        /* Strip leading 'v' for comparison */
        const char *tag_cmp = (tag && tag[0] == 'v') ? tag + 1 : tag;
        const char *ver_cmp = (app_desc->version[0] == 'v')
                              ? app_desc->version + 1 : app_desc->version;

        bool same = tag_cmp && (strcmp(tag_cmp, ver_cmp) == 0);
        resp.update_available = !same;

        resp.has_latest_version = 1;
        resp.latest_version = sstr(tag);

        resp.has_html_url = 1;
        resp.html_url = sstr(sstr_cstr(release.html_url));

        /* Find the matching OTA binary for this target */
        for (int i = 0; i < release.assets_len; i++) {
            const char *name = sstr_cstr(release.assets[i].name);
            if (strstr(name, CONFIG_IDF_TARGET) && strstr(name, ".bin")) {
                resp.has_asset_url = 1;
                resp.asset_url = sstr(sstr_cstr(release.assets[i].browser_download_url));
                break;
            }
        }

        /* If no asset found, report no update available */
        if (!resp.has_asset_url)
            resp.update_available = false;

        github_release_t_clear(&release);
    }

    sstr_t out = sstr_new();
    json_marshal_ota_check_response_t(&resp, out);
    ota_check_response_t_clear(&resp);

    httpd_resp_set_type(req, "application/json");
    httpd_resp_send(req, sstr_cstr(out), (ssize_t)sstr_length(out));
    sstr_free(out);
    return ESP_OK;
}

/* ── OTA task ────────────────────────────────────────────────────────────── */

static void ota_task(void *arg)
{
    char *url = (char *)arg;
    ESP_LOGI(TAG, "OTA task started, URL: %s", url);

    broadcast_ota_progress("starting", -1, NULL);

    config_save_now();

    radio_deinit();
    mqtt_stop();

    esp_http_client_config_t http_cfg = {
        .url               = url,
        .crt_bundle_attach = esp_crt_bundle_attach,
        .keep_alive_enable = true,
        .buffer_size       = 8192,
        .buffer_size_tx    = 2048,
        .timeout_ms        = 30000,
    };
    esp_https_ota_config_t ota_cfg = {
        .http_config = &http_cfg,
    };

    esp_https_ota_handle_t handle = NULL;
    esp_err_t err = esp_https_ota_begin(&ota_cfg, &handle);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "esp_https_ota_begin failed: %s", esp_err_to_name(err));
        broadcast_ota_progress("error", -1, "Failed to start OTA");
        free(url);
        s_ota_in_progress = false;
        vTaskDelay(pdMS_TO_TICKS(2000));
        esp_restart();
        vTaskDelete(NULL);
        return;
    }

    int image_size = esp_https_ota_get_image_size(handle);
    int last_pct   = -1;

    while (true) {
        err = esp_https_ota_perform(handle);
        if (err == ESP_ERR_HTTPS_OTA_IN_PROGRESS) {
            if (image_size > 0) {
                int read = esp_https_ota_get_image_len_read(handle);
                int pct  = (read * 100) / image_size;
                if (pct != last_pct) {
                    broadcast_ota_progress("downloading", pct, NULL);
                    last_pct = pct;
                }
            }
        } else {
            break;
        }
    }

    if (!esp_https_ota_is_complete_data_received(handle)) {
        ESP_LOGE(TAG, "OTA incomplete data received");
        esp_https_ota_abort(handle);
        broadcast_ota_progress("error", -1, "Incomplete firmware data");
        free(url);
        s_ota_in_progress = false;
        vTaskDelay(pdMS_TO_TICKS(2000));
        esp_restart();
        vTaskDelete(NULL);
        return;
    }

    esp_err_t finish_err = esp_https_ota_finish(handle);
    if (finish_err == ESP_OK) {
        ESP_LOGI(TAG, "OTA finished successfully");
        broadcast_ota_progress("done", 100, NULL);
    } else {
        ESP_LOGE(TAG, "esp_https_ota_finish failed: %s", esp_err_to_name(finish_err));
        broadcast_ota_progress("error", -1, "OTA finalization failed");
    }

    free(url);
    s_ota_in_progress = false;
    vTaskDelay(pdMS_TO_TICKS(2000));
    esp_restart();
    vTaskDelete(NULL);
}

/* ── /api/ota/apply ──────────────────────────────────────────────────────── */

static esp_err_t ota_apply_handler(httpd_req_t *req)
{
    REQUIRE_AUTH(req);

    if (s_ota_in_progress) {
        httpd_resp_send_err(req, HTTPD_400_BAD_REQUEST, "OTA already in progress");
        return ESP_OK;
    }

    if (req->content_len <= 0 || req->content_len > 512) {
        httpd_resp_send_err(req, HTTPD_400_BAD_REQUEST, "invalid body");
        return ESP_OK;
    }

    char *buf = malloc((size_t)req->content_len + 1);
    if (!buf) {
        httpd_resp_send_err(req, HTTPD_500_INTERNAL_SERVER_ERROR, "OOM");
        return ESP_OK;
    }
    int received = httpd_req_recv(req, buf, req->content_len);
    if (received <= 0) { free(buf); return received == 0 ? ESP_OK : ESP_FAIL; }
    buf[received] = '\0';

    struct ota_apply_request_t req_body;
    ota_apply_request_t_init(&req_body);
    sstr_t body = sstr_of(buf, (size_t)received);
    int parse_rc = json_unmarshal_ota_apply_request_t(body, &req_body);
    sstr_free(body);
    free(buf);
    buf = NULL;
    if (parse_rc != 0 || sstr_length(req_body.url) == 0) {
        ota_apply_request_t_clear(&req_body);
        httpd_resp_send_err(req, HTTPD_400_BAD_REQUEST, "invalid JSON");
        return ESP_OK;
    }

    char *url = strdup(sstr_cstr(req_body.url));
    ota_apply_request_t_clear(&req_body);

    if (!url) {
        httpd_resp_send_err(req, HTTPD_500_INTERNAL_SERVER_ERROR, "OOM");
        return ESP_OK;
    }

    s_ota_in_progress = true;
    if (xTaskCreate(ota_task, "ota", 8192, url, 5, NULL) != pdPASS) {
        free(url);
        s_ota_in_progress = false;
        httpd_resp_send_err(req, HTTPD_500_INTERNAL_SERVER_ERROR, "task create failed");
        return ESP_OK;
    }

    httpd_resp_set_type(req, "application/json");
    httpd_resp_sendstr(req, "{\"status\":\"started\"}");
    return ESP_OK;
}

/* ── Init ────────────────────────────────────────────────────────────────── */

void ota_init(void)
{
    httpd_handle_t server = webserver_get_handle();
    if (!server) {
        ESP_LOGE(TAG, "webserver not started");
        return;
    }

    static const httpd_uri_t uri_check = {
        .uri    = "/api/ota/check",
        .method = HTTP_GET,
        .handler = ota_check_handler,
    };
    static const httpd_uri_t uri_apply = {
        .uri    = "/api/ota/apply",
        .method = HTTP_POST,
        .handler = ota_apply_handler,
    };

    httpd_register_uri_handler(server, &uri_check);
    httpd_register_uri_handler(server, &uri_apply);
    ESP_LOGI(TAG, "OTA endpoints registered");
}
