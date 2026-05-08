export interface MqttConfig {
  enabled: boolean;
  url: string;
  username: string;
  password: string;
  ha_discovery_enabled: boolean;
  ha_prefix: string;
  mqtt_prefix: string;
}

export interface RadioConfig {
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
}

export type HardwarePreset = "custom" | "heltec_v4";

export interface SettingsData {
  hostname: string;
  mqtt: MqttConfig;
  radio: RadioConfig;
  hardware_preset: HardwarePreset;
  position_status_query_interval_s: number;
  gpio_status_led: number;
  web_password_enabled: boolean;
  web_password: string;
  language: "en" | "pl";
  prometheus_enable: boolean;
}

export interface EffectiveHardwareConfig {
  radio: RadioConfig;
  gpio_status_led: number;
}

export type SaveStatus = "idle" | "loading" | "saving" | "saved" | "rebooting" | "error";

/** Returns the set of GPIO fields that share the same pin number. */
export function findGpioDuplicates(radio: RadioConfig): Set<keyof RadioConfig> {
  const fields: (keyof RadioConfig)[] = [
    "gpio_miso",
    "gpio_mosi",
    "gpio_sck",
    "gpio_csn",
    "gpio_gdo0",
    "gpio_pa_enable",
    ...(radio.type === "sx1262" ? (["gpio_rst", "gpio_busy"] as (keyof RadioConfig)[]) : []),
  ];
  const seen = new Map<number, keyof RadioConfig>();
  const dupes = new Set<keyof RadioConfig>();
  for (const f of fields) {
    const v = radio[f] as number;
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

export function resolveEffectiveHardware(settings: SettingsData): EffectiveHardwareConfig {
  if (settings.hardware_preset === "heltec_v4") {
    return {
      radio: {
        ...settings.radio,
        enabled: true,
        type: "sx1262",
        gpio_miso: 11,
        gpio_mosi: 10,
        gpio_sck: 9,
        gpio_csn: 8,
        gpio_gdo0: 14,
        gpio_rst: 12,
        gpio_busy: 13,
        gpio_pa_enable: 2,
        spi_freq_hz: 500000,
      },
      gpio_status_led: 35,
    };
  }

  return {
    radio: settings.radio,
    gpio_status_led: settings.gpio_status_led,
  };
}
