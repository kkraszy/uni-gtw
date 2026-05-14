import { useContext, useEffect, useState } from "preact/hooks";
import { AuthContext } from "../AuthContext";
import { m } from "../paraglide/messages.js";
import { Button } from "../ui/Button";
import { PageLoader } from "../ui/PageLoader";
import { UiSection } from "./UiSection";
import { HardwareSection } from "./HardwareSection";
import { NetworkSection } from "./NetworkSection";
import { BehaviourSection } from "./BehaviourSection";
import { BackupRestore } from "./BackupRestore";
import { findGpioDuplicates, resolveEffectiveHardware } from "./types";
import type {
  HardwarePresetsResponse,
  HardwarePresetInfo,
  SettingsData,
  SaveStatus,
} from "./types";

export function Settings() {
  const { password } = useContext(AuthContext);
  const [draft, setDraft] = useState<SettingsData | null>(null);
  const [presets, setPresets] = useState<HardwarePresetInfo[]>([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("loading");

  const authHeaders: Record<string, string> = password ? { "X-Auth": password } : {};

  useEffect(() => {
    Promise.all([
      fetch("/api/settings", { headers: authHeaders }).then((r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json() as Promise<SettingsData>;
      }),
      fetch("/api/hardware_presets").then((r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json() as Promise<HardwarePresetsResponse>;
      }),
    ])
      .then(([data, presetResponse]) => {
        if (data.web_password_enabled && !data.web_password) {
          data.web_password = "***UNCHANGED***";
        }
        setDraft(data);
        setPresets(presetResponse.presets);
        setSaveStatus("idle");
      })
      .catch(() => setSaveStatus("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = () => {
    if (!draft) return;
    if (findGpioDuplicates(resolveEffectiveHardware(draft, presets)).size > 0) return;
    setSaveStatus("saving");
    fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify(draft),
    })
      .then((r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json() as Promise<SettingsData>;
      })
      .then((data) => {
        if (data.web_password_enabled && !data.web_password) {
          data.web_password = "***UNCHANGED***";
        }
        setDraft(data);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2500);
      })
      .catch(() => setSaveStatus("error"));
  };

  if (saveStatus === "loading" || !draft) {
    return (
      <PageLoader
        message={saveStatus === "error" ? m.settings_load_error() : m.settings_loading()}
        error={saveStatus === "error"}
      />
    );
  }

  const hasErrors = findGpioDuplicates(resolveEffectiveHardware(draft, presets)).size > 0;

  return (
    <div class="p-4 overflow-y-auto h-full">
      <div class="max-w-lg mx-auto">
        <UiSection settings={draft} onChange={setDraft} />
        <HardwareSection settings={draft} presets={presets} onChange={setDraft} />
        <NetworkSection settings={draft} onChange={setDraft} />
        <BehaviourSection settings={draft} onChange={setDraft} />

        {/* Save */}
        <div class="flex items-center gap-3 flex-wrap mb-2">
          <Button
            variant="primary"
            onClick={save}
            disabled={saveStatus === "saving" || saveStatus === "rebooting" || hasErrors}
            title={hasErrors ? m.settings_gpio_hint() : undefined}
          >
            {saveStatus === "saving" ? m.settings_saving() : m.settings_save()}
          </Button>
          {saveStatus === "saved" && (
            <span class="text-green-400 text-xs">{m.settings_saved()}</span>
          )}
          {saveStatus === "rebooting" && (
            <span class="text-amber-400 text-xs">{m.status_rebooting()}</span>
          )}
          {saveStatus === "error" && (
            <span class="text-red-400 text-xs">{m.status_error_connection()}</span>
          )}
        </div>

        <BackupRestore hostname={draft.hostname} authHeaders={authHeaders} />
      </div>
    </div>
  );
}
