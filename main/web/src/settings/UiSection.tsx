import { FieldLabel } from "../ui/FieldLabel";
import { SubSection } from "../ui/SubSection";
import { SectionCard } from "../ui/SectionCard";
import { Monitor } from "lucide-preact";
import type { SettingsData } from "./types";
import { m } from "../paraglide/messages.js";

interface Props {
  settings: SettingsData;
  onChange: (updated: SettingsData) => void;
}

export function UiSection({ settings, onChange }: Props) {
  return (
    <SectionCard icon={Monitor} title={m.ui_section_title()}>
      {/* Language */}
      <div>
        <FieldLabel>{m.ui_language_label()}</FieldLabel>
        <select
          value={settings.language}
          onChange={(e) =>
            onChange({
              ...settings,
              language: (e.target as HTMLSelectElement).value as "en" | "pl",
            })
          }
          class="bg-zinc-800 text-zinc-100 border border-zinc-600 rounded px-2 py-1 text-xs font-mono"
        >
          <option value="en">English</option>
          <option value="pl">Polski</option>
        </select>
      </div>

      {/* Security */}
      <SubSection title={m.ui_password_section()}>
        <label class="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={settings.web_password_enabled}
            onChange={(e) => {
              const enabled = (e.target as HTMLInputElement).checked;
              onChange({
                ...settings,
                web_password_enabled: enabled,
                web_password: enabled ? "***UNCHANGED***" : "",
              });
            }}
            class="w-4 h-4 accent-blue-500"
          />
          <span class="text-xs text-zinc-300">{m.ui_enable_password()}</span>
        </label>
        {settings.web_password_enabled && (
          <div class="mt-3">
            <FieldLabel>{m.label_password()}</FieldLabel>
            <input
              type="password"
              value={settings.web_password}
              onInput={(e) =>
                onChange({
                  ...settings,
                  web_password: (e.target as HTMLInputElement).value,
                })
              }
              class="w-full bg-zinc-800 text-zinc-100 border border-zinc-600 rounded px-2 py-1 text-xs font-mono"
            />
            <p class="text-zinc-600 text-xs mt-1">{m.ui_password_hint()}</p>
          </div>
        )}
      </SubSection>
    </SectionCard>
  );
}
