import { FieldLabel } from "../ui/FieldLabel";
import { Hint } from "../ui/Hint";
import { SubSection } from "../ui/SubSection";
import { SectionCard } from "../ui/SectionCard";
import { Collapsible } from "../ui/Collapsible";
import { Globe, Server } from "lucide-preact";
import type { SettingsData, MqttConfig } from "./types";

interface Props {
  settings: SettingsData;
  onChange: (updated: SettingsData) => void;
}

export function NetworkSection({ settings, onChange }: Props) {
  const mqttDisabled = !settings.mqtt.enabled;

  const updateMqtt = <K extends keyof MqttConfig>(key: K, value: MqttConfig[K]) => {
    onChange({ ...settings, mqtt: { ...settings.mqtt, [key]: value } });
  };

  return (
    <SectionCard icon={Globe} title="Network">
      {/* General */}
      <SubSection title="General" divided={false}>
        <FieldLabel>Hostname</FieldLabel>
        <input
          type="text"
          value={settings.hostname}
          maxLength={63}
          onInput={(e) =>
            onChange({
              ...settings,
              hostname: (e.target as HTMLInputElement).value,
            })
          }
          class="w-full bg-zinc-800 text-zinc-100 border border-zinc-600 rounded px-2 py-1 text-xs font-mono"
        />
        <Hint>
          Reachable via mDNS as{" "}
          <span class="text-zinc-400 font-mono">{settings.hostname}.local</span>
        </Hint>
      </SubSection>

      {/* MQTT */}
      <SubSection icon={Server} title="MQTT">
        <label class="flex items-center gap-2 cursor-pointer select-none mb-3">
          <input
            type="checkbox"
            checked={settings.mqtt.enabled}
            onChange={(e) => updateMqtt("enabled", (e.target as HTMLInputElement).checked)}
            class="w-4 h-4 accent-blue-500"
          />
          <span class="text-xs text-zinc-300">Enable MQTT</span>
        </label>

        <div class={mqttDisabled ? "opacity-40 pointer-events-none" : ""}>
          <div class="flex flex-col gap-3">
            <div>
              <FieldLabel>MQTT URL</FieldLabel>
              <input
                type="text"
                value={settings.mqtt.url}
                placeholder="mqtt://192.168.1.100:1883"
                onInput={(e) => updateMqtt("url", (e.target as HTMLInputElement).value)}
                class="w-full bg-zinc-800 text-zinc-100 border border-zinc-600 rounded px-2 py-1 text-xs font-mono"
              />
              <Hint>Use mqtt:// or mqtts://</Hint>
            </div>

            <div>
              <FieldLabel>Username</FieldLabel>
              <input
                type="text"
                value={settings.mqtt.username}
                onInput={(e) => updateMqtt("username", (e.target as HTMLInputElement).value)}
                class="w-full bg-zinc-800 text-zinc-100 border border-zinc-600 rounded px-2 py-1 text-xs font-mono"
              />
            </div>

            <div>
              <FieldLabel>Password</FieldLabel>
              <input
                type="password"
                value={settings.mqtt.password}
                onInput={(e) => updateMqtt("password", (e.target as HTMLInputElement).value)}
                class="w-full bg-zinc-800 text-zinc-100 border border-zinc-600 rounded px-2 py-1 text-xs font-mono"
              />
            </div>
          </div>

          <div class="border-t border-zinc-800 mt-4 pt-3">
            <Collapsible label="Advanced">
              <div class="flex flex-col gap-3 mt-2">
                <div>
                  <FieldLabel>MQTT prefix</FieldLabel>
                  <input
                    type="text"
                    value={settings.mqtt.mqtt_prefix}
                    placeholder="unigtw"
                    onInput={(e) => updateMqtt("mqtt_prefix", (e.target as HTMLInputElement).value)}
                    class="w-full bg-zinc-800 text-zinc-100 border border-zinc-600 rounded px-2 py-1 text-xs font-mono"
                  />
                </div>

                <label class="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={settings.mqtt.ha_discovery_enabled}
                    onChange={(e) =>
                      updateMqtt("ha_discovery_enabled", (e.target as HTMLInputElement).checked)
                    }
                    class="w-4 h-4 accent-blue-500"
                  />
                  <span class="text-xs text-zinc-300">Enable Home Assistant discovery</span>
                </label>

                {settings.mqtt.ha_discovery_enabled && (
                  <div>
                    <FieldLabel>HA discovery prefix</FieldLabel>
                    <input
                      type="text"
                      value={settings.mqtt.ha_prefix}
                      placeholder="homeassistant"
                      onInput={(e) => updateMqtt("ha_prefix", (e.target as HTMLInputElement).value)}
                      class="w-full bg-zinc-800 text-zinc-100 border border-zinc-600 rounded px-2 py-1 text-xs font-mono"
                    />
                  </div>
                )}
              </div>
            </Collapsible>
          </div>
        </div>
      </SubSection>
    </SectionCard>
  );
}
