# uni-gtw — ESP32 RF Gateway

ESP32-based RF gateway for controlling Cosmo blinds over the air.
Serves a Preact SPA over HTTP with a WebSocket console and channel controls.

## Toolchain

- **IDF path**: `/opt/esp-idf` (v6.0.0)
- **Target**: ESP32
- **Flash tool**: `idf.py -p /dev/serial/by-id/usb-Silicon_Labs_CP2102_USB_to_UART_Bridge_Controller_0001-if00-port0 flash monitor`
- **Frontend**: pnpm + Vite + Preact (TypeScript)

## Build

```bash
# First time / after frontend changes
cd main/web && pnpm install && pnpm run build && cd ../..

# Firmware build (also runs pnpm build via cmake target)
idf.py build

# Flash + monitor
idf.py -p /dev/serial/... flash monitor
```

## Frontend checks

Run all three checks (TypeScript, lint, format) in one command:

```bash
cd main/web && pnpm run check
```

Individual scripts:

| Script | Tool | Purpose |
|---|---|---|
| `pnpm run typecheck` | `tsc --noEmit` | Type-check with TypeScript 6 |
| `pnpm run lint` | `oxlint src` | Lint with Oxlint (config: `.oxlintrc.json`) |
| `pnpm run lint:fix` | `oxlint --fix src` | Auto-fix safe lint issues |
| `pnpm run fmt` | `oxfmt src` | Format files in place |
| `pnpm run fmt:check` | `oxfmt --check src` | Verify formatting without writing |

All three checks also run as steps inside the `typecheck` CI job on every push/PR.

## Project layout

```
uni-gtw/
├── CMakeLists.txt           # project root — adds components/ to EXTRA_COMPONENT_DIRS
├── partitions.csv           # nvs / ota_0 / ota_1 / littlefs
├── sdkconfig.defaults
├── components/
│   ├── cosmo/               # KeeLoq encode/decode component
│   │   ├── cosmo.c
│   │   ├── CMakeLists.txt   # idf_component_register, PRIV_REQUIRES log
│   │   ├── include/
│   │   │   ├── cosmo/cosmo.h   ← canonical header (include as "cosmo/cosmo.h")
│   │   │   └── cosmo.h         ← shim: #include "cosmo/cosmo.h"
│   │   └── test/            # host-side Unity tests (standalone CMake)
│   │       ├── CMakeLists.txt  # FetchContent Unity v2.6.0
│   │       └── test_cosmo.c
│   └── esp_littlefs/        # managed component
└── main/
    ├── CMakeLists.txt       # SRCS, EMBED_FILES, pnpm_build target
    ├── idf_component.yml    # managed deps (json_generator)
    ├── uni-gtw.c            # app_main: nvs, littlefs, wifi, channel_init, radio_init
    ├── webserver.h / .c     # HTTP + WebSocket server, gtw_console_log
    ├── channel.h / .c       # cosmo_channel_t store, JSON, WS broadcast
    ├── radio.h / .c         # FreeRTOS radio task (RX ISR + TX queue)
    ├── cc1101.h / .c        # CC1101 SPI driver (pure hardware)
    ├── cosmo.h              # redirect: #include "cosmo/cosmo.h"
    └── web/                 # Preact SPA
        ├── package.json     # preact, vite, @preact/preset-vite

            ├── main.tsx
            ├── App.tsx         # WS connection lifted here; manages lines + channels state
            ├── Console.tsx     # accepts lines: string[] prop
            ├── Channels.tsx    # channel list + UP/STOP/DOWN buttons + new channel form
            ├── wsTypes.ts      # discriminated-union WsMessage + shared payload types
            └── useWebsocket.tsx # useWebsocket / useJsonWebsocket hooks
```

## Key design decisions

### Include path — cosmo header
`components/cosmo/include/cosmo/cosmo.h` (subdirectory) prevents shadowing by
`main/cosmo.h`. Always `#include "cosmo/cosmo.h"`, never `#include "cosmo.h"`.

### KeeLoq byte order
The encrypted block is **little-endian**: `data[0]` is the LSB of the 32-bit word.
Both `cosmo_decode` and `cosmo_encode` assemble/disassemble bytes accordingly.

### WebSocket async sends
All WS frame sends go through `httpd_queue_work` to avoid stack overflows from
non-httpd tasks. Pattern: allocate `ws_send_work_t` (flexible array JSON payload),
queue, free in the work function.

### Radio task
Single `QueueHandle_t` carries tagged `radio_evt_t` structs for both ISR→task
(RADIO_EVT_RX on GDO0 falling edge) and task→task (RADIO_EVT_TX from
`radio_request_tx`). CC1101 is put idle during TX; GDO0 ISR is suppressed
implicitly (queue simply won't fill during TX window).

### CC1101 APPEND_STATUS
PKTCTRL1 default appends 2 status bytes after each received packet.
`COSMO_STATUS_BYTES = 2`. RSSI is `buf[COSMO_RAW_PACKET_LEN]`:
`rssi_dbm = (raw >= 128) ? (raw-256)/2 - 74 : raw/2 - 74`.

### Channel system
- `cosmo_channel_t`: name, proto, serial (unique key), counter, state
- Serial generated with `esp_random()`, guaranteed unique among existing channels
- State updated optimistically on TX (UP→open, DOWN→closed, STOP→no change)
- `channel_update_from_packet()` called in radio task after every successful RX decode
- All updates broadcast as `{"cmd":"channel_update","payload":{...}}`
- New WS clients receive `{"cmd":"channels","payload":[...]}` + console history

### Filesystem
LittleFS mounted at `/littlefs` on the `littlefs` partition (see `partitions.csv`).
Initialised in `app_main` before WiFi. Reserved for future channel persistence.

### WebSocket message protocol

**Server → client:**
| `cmd` | payload | trigger |
|---|---|---|
| `console` | string | `gtw_console_log(...)` |
| `channels` | `Channel[]` | new client connects |
| `channel_update` | `Channel` | any channel state change |

**Client → server:**
| `cmd` | fields | effect |
|---|---|---|
| `create_channel` | `name`, `proto` ("1way"\|"2way") | creates channel, random serial |
| `channel_cmd` | `serial`, `cmd_name` ("UP"\|"DOWN"\|"STOP") | TX with repeat=3, counter++ |

## i18n (Paraglide JS)

The frontend uses [Paraglide JS](https://inlang.com/m/gerre34r/library-inlang-paraglideJs) for compile-time i18n. Supported locales: `en` (source) and `pl`.

### File locations
- `main/web/messages/en.json` — English source strings (all keys defined here)
- `main/web/messages/pl.json` — Polish translations (must have all keys from `en.json`)
- `main/web/project.inlang/settings.json` — Inlang project config
- `main/web/src/paraglide/` — **generated** at build time by the Vite plugin; not committed

### How it works
- The Vite plugin (`paraglideVitePlugin`) generates `src/paraglide/messages.js` and `src/paraglide/runtime.js` on every `vite dev` / `vite build`.
- `AuthGuard.tsx` calls `setLocale(lang)` once before rendering, using the `language` field from `/api/info`. No runtime locale switching.
- All components import `{ m } from "../paraglide/messages.js"` and call `m.key_name()` at render time (never at module level — the locale might not be set yet).

### Adding a new string
1. Add the key to `messages/en.json` with the English text.
2. Add the same key to `messages/pl.json` with the Polish translation.
3. Use `m.key_name()` in the component.

### Strings with markup tags (`{#strong}`, `{#code}`, etc.)
Use `ParaglideMessage` from `@inlang/paraglide-js-react`:
```tsx
import { ParaglideMessage } from "@inlang/paraglide-js-react";

<ParaglideMessage
  message={m.my_key}
  inputs={{}}
  markup={{ strong: ({ children }) => <strong>{children}</strong> }}
/>
```

### Strings with parameters (`{paramName}`)
Pass as named inputs to the message function:
```tsx
m.form_edit_channel({ name: channel.name })
m.time_seconds_ago({ n: seconds })
```

### Module-level string constants
Never put `m.xxx()` calls at module level — they run before `setLocale()`. Use functions instead:
```ts
// Wrong — evaluates before locale is set
const LABELS = { up: m.btn_up() };

// Correct — called at render time
const getLabels = () => ({ up: m.btn_up() });
```

## Running cosmo unit tests

```bash
cd components/cosmo/test
cmake -B build && cmake --build build
cd build && ctest --output-on-failure
```
