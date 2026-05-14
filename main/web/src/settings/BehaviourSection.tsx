import { FieldLabel } from "../ui/FieldLabel";
import { SubSection } from "../ui/SubSection";
import { SectionCard } from "../ui/SectionCard";
import { SlidersHorizontal } from "lucide-preact";
import type { SettingsData } from "./types";
import { m } from "../paraglide/messages.js";
import { ParaglideMessage } from "@inlang/paraglide-js-react";

interface Props {
  settings: SettingsData;
  onChange: (updated: SettingsData) => void;
}

export function BehaviourSection({ settings, onChange }: Props) {
  return (
    <SectionCard icon={SlidersHorizontal} title={m.behaviour_section_title()}>
      <div>
        <FieldLabel>{m.behaviour_pos_query_label()}</FieldLabel>
        <div class="flex items-center gap-2">
          <input
            type="number"
            value={settings.position_status_query_interval_s}
            min={0}
            max={65535}
            onInput={(e) =>
              onChange({
                ...settings,
                position_status_query_interval_s: Math.min(
                  65535,
                  Math.max(0, parseInt((e.target as HTMLInputElement).value) || 0),
                ),
              })
            }
            class="w-28 bg-zinc-800 text-zinc-100 border border-zinc-600 rounded px-2 py-1 text-xs font-mono"
          />
          <span class="text-zinc-500 text-xs">{m.behaviour_pos_query_unit()}</span>
        </div>
        <p class="text-zinc-600 text-xs mt-1">{m.behaviour_pos_query_hint()}</p>
      </div>

      <SubSection title={m.behaviour_observability_section()}>
        <label class="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={settings.prometheus_enable}
            onChange={(e) =>
              onChange({
                ...settings,
                prometheus_enable: (e.target as HTMLInputElement).checked,
              })
            }
            class="w-4 h-4 accent-blue-500"
          />
          <span class="text-xs text-zinc-300">
            <ParaglideMessage
              message={m.behaviour_enable_prometheus}
              inputs={{}}
              markup={{
                code: ({ children }) => <span class="font-mono text-zinc-400">{children}</span>,
              }}
            />
          </span>
        </label>
      </SubSection>
    </SectionCard>
  );
}
