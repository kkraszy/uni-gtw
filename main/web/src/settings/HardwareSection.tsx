import { useEffect, useRef } from "preact/hooks";
import { Alert } from "../ui/Alert";
import { Hint } from "../ui/Hint";
import { SubSection } from "../ui/SubSection";
import { SectionCard } from "../ui/SectionCard";
import { Cpu, Lightbulb, Monitor, Radio } from "lucide-preact";
import { findGpioDuplicates, resolveEffectiveHardware } from "./types";
import type { SettingsData, HardwareConfig, HardwarePreset, HardwarePresetInfo } from "./types";

interface Props {
  settings: SettingsData;
  presets: HardwarePresetInfo[];
  onChange: (updated: SettingsData) => void;
}

const GPIO_FIELDS_BASE: { key: keyof HardwareConfig; label: string }[] = [
  { key: "gpio_miso", label: "MISO" },
  { key: "gpio_mosi", label: "MOSI" },
  { key: "gpio_sck", label: "SCK" },
  { key: "gpio_csn", label: "CSN" },
];

function GpioInput({
  label,
  value,
  error,
  disabled = false,
  onChange,
  min = 0,
}: {
  label: string;
  value: number;
  error: boolean;
  disabled?: boolean;
  onChange: (v: number) => void;
  min?: number;
}) {
  return (
    <div class={`flex items-center gap-2 ${disabled ? "opacity-60" : ""}`}>
      <label class="w-14 shrink-0 text-xs text-zinc-400 text-right">{label}</label>
      <input
        type="number"
        value={value}
        min={min}
        max={39}
        disabled={disabled}
        onInput={(e) => {
          const parsed = parseInt((e.target as HTMLInputElement).value);
          onChange(isNaN(parsed) ? min : parsed);
        }}
        class={`w-20 bg-zinc-800 text-zinc-100 border rounded px-2 py-1 text-xs font-mono ${
          error ? "border-red-500" : "border-zinc-600"
        }`}
      />
      {error && <span class="text-red-400 text-xs">duplicate</span>}
      {!error && value < 0 && <span class="text-zinc-500 text-xs">disabled</span>}
    </div>
  );
}

export function HardwareSection({ settings, presets, onChange }: Props) {
  const radioSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = () =>
      radioSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.addEventListener("settings:scroll-radio", handler);
    return () => window.removeEventListener("settings:scroll-radio", handler);
  }, []);

  const effectiveHardware = resolveEffectiveHardware(settings, presets);
  const customHardware = settings.hardware_preset === "custom";
  const selectedPreset = customHardware
    ? null
    : (presets.find((preset) => preset.id === settings.hardware_preset) ?? null);
  const gpioDupes = findGpioDuplicates(effectiveHardware);
  const radioDisabled = !effectiveHardware.enabled;

  const updateHardware = <K extends keyof HardwareConfig>(key: K, value: HardwareConfig[K]) => {
    onChange({
      ...settings,
      hardware: { ...settings.hardware, [key]: value },
    });
  };

  return (
    <SectionCard icon={Cpu} title="Hardware">
      <SubSection title="Hardware preset" divided={false}>
        <select
          value={settings.hardware_preset}
          onChange={(e) =>
            onChange({
              ...settings,
              hardware_preset: (e.target as HTMLSelectElement).value as HardwarePreset,
            })
          }
          class="w-full bg-zinc-800 text-zinc-100 border border-zinc-600 rounded px-2 py-1 text-xs font-mono"
        >
          <option value="custom">Custom</option>
          {presets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name}
            </option>
          ))}
        </select>
        {selectedPreset && (
          <div class="mt-3 rounded border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-300">
            <p class="text-zinc-100 font-medium">{selectedPreset.description}</p>
            <p class="mt-2 font-mono text-zinc-400">
              {selectedPreset.hardware.type.toUpperCase()} | MISO{" "}
              {selectedPreset.hardware.gpio_miso} | MOSI {selectedPreset.hardware.gpio_mosi} | SCK{" "}
              {selectedPreset.hardware.gpio_sck} | CSN {selectedPreset.hardware.gpio_csn}
            </p>
            <p class="mt-1 font-mono text-zinc-400">
              {selectedPreset.hardware.type === "sx1262" ? "DIO1" : "GDO0"}{" "}
              {selectedPreset.hardware.gpio_gdo0}
              {selectedPreset.hardware.type === "sx1262" && (
                <>
                  {" "}
                  | RST {selectedPreset.hardware.gpio_rst} | BUSY{" "}
                  {selectedPreset.hardware.gpio_busy}
                </>
              )}{" "}
              | PA EN {selectedPreset.hardware.gpio_pa_enable} | LED{" "}
              {selectedPreset.hardware.gpio_status_led}
            </p>
            <p class="mt-1 font-mono text-zinc-400">
              {selectedPreset.hardware.oled_enabled
                ? `OLED SDA ${selectedPreset.hardware.gpio_i2c_sda} | SCL ${selectedPreset.hardware.gpio_i2c_scl} | PWR ${selectedPreset.hardware.gpio_oled_power} | RST ${selectedPreset.hardware.gpio_oled_reset}`
                : "OLED disabled"}
            </p>
          </div>
        )}
      </SubSection>

      {/* Radio */}
      {customHardware && (
        <div ref={radioSectionRef}>
          <SubSection icon={Radio} title="Radio">
            <label class="flex items-center gap-2 cursor-pointer select-none mb-3">
              <input
                type="checkbox"
                checked={settings.hardware.enabled}
                onChange={(e) => updateHardware("enabled", (e.target as HTMLInputElement).checked)}
                class="w-4 h-4 accent-blue-500"
              />
              <span class="text-xs text-zinc-300">Enable radio</span>
            </label>

            {radioDisabled && (
              <Alert class="mb-3">
                Radio is disabled. The gateway will not be able to control or receive status from
                blinds until the radio is enabled and saved.
              </Alert>
            )}

            <div>
              <label class="block mb-1 text-xs text-zinc-400">Radio type</label>
              <select
                value={effectiveHardware.type}
                disabled={radioDisabled}
                onChange={(e) =>
                  updateHardware(
                    "type",
                    (e.target as HTMLSelectElement).value as "cc1101" | "sx1262",
                  )
                }
                class={`bg-zinc-800 text-zinc-100 border border-zinc-600 rounded px-2 py-1 text-xs font-mono ${
                  radioDisabled ? "opacity-60" : ""
                }`}
              >
                <option value="cc1101">CC1101</option>
                <option value="sx1262">SX1262</option>
              </select>
            </div>

            <Hint>GPIO pin numbers for the SPI connection.</Hint>

            <div class={radioDisabled ? "opacity-40 pointer-events-none" : ""}>
              <div class="flex flex-col gap-2 mt-2">
                {GPIO_FIELDS_BASE.map(({ key, label }) => (
                  <GpioInput
                    key={key}
                    label={label}
                    value={effectiveHardware[key] as number}
                    error={gpioDupes.has(key)}
                    disabled={radioDisabled}
                    onChange={(v) => updateHardware(key, v)}
                  />
                ))}
                <GpioInput
                  label={effectiveHardware.type === "sx1262" ? "DIO1" : "GDO0"}
                  value={effectiveHardware.gpio_gdo0}
                  error={gpioDupes.has("gpio_gdo0")}
                  disabled={radioDisabled}
                  onChange={(v) => updateHardware("gpio_gdo0", v)}
                />
                {effectiveHardware.type === "sx1262" && (
                  <>
                    <GpioInput
                      label="RST"
                      value={effectiveHardware.gpio_rst}
                      error={gpioDupes.has("gpio_rst")}
                      disabled={radioDisabled}
                      onChange={(v) => updateHardware("gpio_rst", v)}
                    />
                    <GpioInput
                      label="BUSY"
                      value={effectiveHardware.gpio_busy}
                      error={gpioDupes.has("gpio_busy")}
                      disabled={radioDisabled}
                      onChange={(v) => updateHardware("gpio_busy", v)}
                    />
                  </>
                )}
                <GpioInput
                  label="PA EN"
                  value={effectiveHardware.gpio_pa_enable}
                  error={gpioDupes.has("gpio_pa_enable")}
                  disabled={radioDisabled}
                  onChange={(v) => updateHardware("gpio_pa_enable", v)}
                  min={-1}
                />
                {gpioDupes.size > 0 && (
                  <p class="text-red-400 text-xs">
                    Each GPIO pin must be assigned to exactly one signal.
                  </p>
                )}
              </div>

              <div class="flex items-center gap-2 mt-3">
                <label class="text-xs text-zinc-400 shrink-0">SPI clock</label>
                <input
                  type="number"
                  value={effectiveHardware.spi_freq_hz}
                  min={100000}
                  max={10000000}
                  step={100000}
                  disabled={radioDisabled}
                  onInput={(e) =>
                    updateHardware(
                      "spi_freq_hz",
                      Math.max(100000, parseInt((e.target as HTMLInputElement).value) || 500000),
                    )
                  }
                  class={`w-32 bg-zinc-800 text-zinc-100 border border-zinc-600 rounded px-2 py-1 text-xs font-mono ${
                    radioDisabled ? "opacity-60" : ""
                  }`}
                />
                <span class="text-zinc-500 text-xs">Hz</span>
              </div>
            </div>
          </SubSection>
        </div>
      )}

      {/* Status LED */}
      {customHardware && (
        <SubSection icon={Lightbulb} title="Status LED">
          <div class="flex items-center gap-2 mt-2">
            <label class="w-14 shrink-0 text-xs text-zinc-400 text-right">GPIO</label>
            <input
              type="number"
              value={effectiveHardware.gpio_status_led}
              min={-1}
              max={39}
              onInput={(e) =>
                onChange({
                  ...settings,
                  hardware: {
                    ...settings.hardware,
                    gpio_status_led: Math.max(
                      -1,
                      Math.min(39, parseInt((e.target as HTMLInputElement).value) || -1),
                    ),
                  },
                })
              }
              class="w-20 bg-zinc-800 text-zinc-100 border border-zinc-600 rounded px-2 py-1 text-xs font-mono"
            />
            {effectiveHardware.gpio_status_led < 0 && (
              <span class="text-zinc-500 text-xs">disabled</span>
            )}
          </div>
        </SubSection>
      )}

      {customHardware && (
        <SubSection icon={Monitor} title="OLED">
          <label class="flex items-center gap-2 cursor-pointer select-none mb-3">
            <input
              type="checkbox"
              checked={settings.hardware.oled_enabled}
              onChange={(e) =>
                updateHardware("oled_enabled", (e.target as HTMLInputElement).checked)
              }
              class="w-4 h-4 accent-blue-500"
            />
            <span class="text-xs text-zinc-300">Enable SSD1306 OLED</span>
          </label>

          <Hint>The OLED uses I2C. Set the SDA and SCL GPIOs, plus an optional reset pin.</Hint>

          <div
            class={!effectiveHardware.oled_enabled ? "opacity-40 pointer-events-none mt-2" : "mt-2"}
          >
            <div class="flex flex-col gap-2">
              <GpioInput
                label="SDA"
                value={effectiveHardware.gpio_i2c_sda}
                error={gpioDupes.has("gpio_i2c_sda")}
                disabled={!effectiveHardware.oled_enabled}
                onChange={(v) => updateHardware("gpio_i2c_sda", v)}
              />
              <GpioInput
                label="SCL"
                value={effectiveHardware.gpio_i2c_scl}
                error={gpioDupes.has("gpio_i2c_scl")}
                disabled={!effectiveHardware.oled_enabled}
                onChange={(v) => updateHardware("gpio_i2c_scl", v)}
              />
              <GpioInput
                label="PWR"
                value={effectiveHardware.gpio_oled_power}
                error={gpioDupes.has("gpio_oled_power")}
                disabled={!effectiveHardware.oled_enabled}
                onChange={(v) => updateHardware("gpio_oled_power", v)}
                min={-1}
              />
              <GpioInput
                label="RST"
                value={effectiveHardware.gpio_oled_reset}
                error={gpioDupes.has("gpio_oled_reset")}
                disabled={!effectiveHardware.oled_enabled}
                onChange={(v) => updateHardware("gpio_oled_reset", v)}
                min={-1}
              />
            </div>
          </div>
        </SubSection>
      )}
    </SectionCard>
  );
}
