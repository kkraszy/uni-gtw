export interface MqttConfig {
  enabled: boolean;
  url: string;
  username: string;
  password: string;
  ha_discovery_enabled: boolean;
  ha_prefix: string;
  mqtt_prefix: string;
}

export interface HardwareConfig {
  enabled: boolean;
  type: "cc1101" | "sx1262";
  gpio_miso: number;
  gpio_mosi: number;
  gpio_sck: number;
  gpio_csn: number;
  gpio_gdo0: number;
  gpio_rst: number;
  gpio_busy: number;
  gpio_pa_enable: number;
  spi_freq_hz: number;
  gpio_status_led: number;
}

export type HardwarePreset =
  | "custom"
  | "alufers_esp_cc1101_board"
  | "heltec_v4"
  | "xiao_esp32s3_wio_sx1262";

export interface HardwarePresetInfo {
  id: Exclude<HardwarePreset, "custom">;
  name: string;
  description: string;
  hardware: HardwareConfig;
}

export interface HardwarePresetsResponse {
  presets: HardwarePresetInfo[];
}

export interface SettingsData {
  hostname: string;
  mqtt: MqttConfig;
  hardware: HardwareConfig;
  hardware_preset: HardwarePreset;
  position_status_query_interval_s: number;
  web_password_enabled: boolean;
  web_password: string;
  language: "en" | "pl";
  prometheus_enable: boolean;
}

export type SaveStatus = "idle" | "loading" | "saving" | "saved" | "rebooting" | "error";

/** Returns the set of GPIO fields that share the same pin number. */
export function findGpioDuplicates(hardware: HardwareConfig): Set<keyof HardwareConfig> {
  const fields: (keyof HardwareConfig)[] = [
    "gpio_miso",
    "gpio_mosi",
    "gpio_sck",
    "gpio_csn",
    "gpio_gdo0",
    "gpio_pa_enable",
    ...(hardware.type === "sx1262" ? (["gpio_rst", "gpio_busy"] as (keyof HardwareConfig)[]) : []),
  ];
  const seen = new Map<number, keyof HardwareConfig>();
  const dupes = new Set<keyof HardwareConfig>();
  for (const f of fields) {
    const v = hardware[f] as number;
    if (v < 0) continue; // -1 means disabled/not assigned — never a conflict
    if (seen.has(v)) {
      dupes.add(f);
      dupes.add(seen.get(v)!);
    } else {
      seen.set(v, f);
    }
  }
  return dupes;
}

export function resolveEffectiveHardware(
  settings: SettingsData,
  presets: HardwarePresetInfo[],
): HardwareConfig {
  if (settings.hardware_preset === "custom") {
    return settings.hardware;
  }

  return (
    presets.find((preset) => preset.id === settings.hardware_preset)?.hardware ?? settings.hardware
  );
}
