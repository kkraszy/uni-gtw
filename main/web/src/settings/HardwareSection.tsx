import { useEffect, useRef } from "preact/hooks";
import { Alert } from "../ui/Alert";
import { Hint } from "../ui/Hint";
import { SubSection } from "../ui/SubSection";
import { SectionCard } from "../ui/SectionCard";
import { Cpu, Lightbulb, Radio } from "lucide-preact";
import { findGpioDuplicates, resolveEffectiveHardware } from "./types";
import type { SettingsData, RadioConfig, HardwarePreset } from "./types";

interface Props {
  settings: SettingsData;
  onChange: (updated: SettingsData) => void;
}

const GPIO_FIELDS_BASE: { key: keyof RadioConfig; label: string }[] = [
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

export function HardwareSection({ settings, onChange }: Props) {
  const radioSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = () =>
      radioSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.addEventListener("settings:scroll-radio", handler);
    return () => window.removeEventListener("settings:scroll-radio", handler);
  }, []);

  const effectiveHardware = resolveEffectiveHardware(settings);
  const effectiveRadio = effectiveHardware.radio;
  const customHardware = settings.hardware_preset === "custom";
  const gpioDupes = findGpioDuplicates(effectiveRadio);
  const radioDisabled = !effectiveRadio.enabled;

  const updateRadio = <K extends keyof RadioConfig>(key: K, value: RadioConfig[K]) => {
    onChange({ ...settings, radio: { ...settings.radio, [key]: value } });
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
          <option value="heltec_v4">Heltec V4</option>
        </select>
      </SubSection>

      {/* Radio */}
      {customHardware && (
        <div ref={radioSectionRef}>
          <SubSection icon={Radio} title="Radio">
            <label class="flex items-center gap-2 cursor-pointer select-none mb-3">
              <input
                type="checkbox"
                checked={settings.radio.enabled}
                onChange={(e) => updateRadio("enabled", (e.target as HTMLInputElement).checked)}
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
                value={effectiveRadio.type}
                disabled={radioDisabled}
                onChange={(e) =>
                  updateRadio("type", (e.target as HTMLSelectElement).value as "cc1101" | "sx1262")
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
                    value={effectiveRadio[key] as number}
                    error={gpioDupes.has(key)}
                    disabled={radioDisabled}
                    onChange={(v) => updateRadio(key, v)}
                  />
                ))}
                <GpioInput
                  label={effectiveRadio.type === "sx1262" ? "DIO1" : "GDO0"}
                  value={effectiveRadio.gpio_gdo0}
                  error={gpioDupes.has("gpio_gdo0")}
                  disabled={radioDisabled}
                  onChange={(v) => updateRadio("gpio_gdo0", v)}
                />
                {effectiveRadio.type === "sx1262" && (
                  <>
                    <GpioInput
                      label="RST"
                      value={effectiveRadio.gpio_rst}
                      error={gpioDupes.has("gpio_rst")}
                      disabled={radioDisabled}
                      onChange={(v) => updateRadio("gpio_rst", v)}
                    />
                    <GpioInput
                      label="BUSY"
                      value={effectiveRadio.gpio_busy}
                      error={gpioDupes.has("gpio_busy")}
                      disabled={radioDisabled}
                      onChange={(v) => updateRadio("gpio_busy", v)}
                    />
                  </>
                )}
                <GpioInput
                  label="PA EN"
                  value={effectiveRadio.gpio_pa_enable}
                  error={gpioDupes.has("gpio_pa_enable")}
                  disabled={radioDisabled}
                  onChange={(v) => updateRadio("gpio_pa_enable", v)}
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
                  value={effectiveRadio.spi_freq_hz}
                  min={100000}
                  max={10000000}
                  step={100000}
                  disabled={radioDisabled}
                  onInput={(e) =>
                    updateRadio(
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
                  gpio_status_led: Math.max(
                    -1,
                    Math.min(39, parseInt((e.target as HTMLInputElement).value) || -1),
                  ),
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
    </SectionCard>
  );
}
