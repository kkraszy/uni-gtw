import { useEffect, useRef, useState } from "preact/hooks";
import { X, Plus, Radio } from "lucide-preact";
import { Button } from "./ui/Button";
import { FieldLabel } from "./ui/FieldLabel";
import { Channel, DeviceClass, DEVICE_CLASS_OPTIONS, toMqttName } from "./channelTypes";
import { PacketInfo } from "./wsTypes";
import { m } from "./paraglide/messages.js";

// cosmo_cmd_t values for motion commands
const MOTION_CMDS = new Set([1, 2, 4]); // STOP=1, UP=2, DOWN=4

function deviceClassLabel(cls: DeviceClass): string {
  switch (cls) {
    case "generic":
      return m.device_class_generic();
    case "awning":
      return m.device_class_awning();
    case "blind":
      return m.device_class_blind();
    case "curtain":
      return m.device_class_curtain();
    case "damper":
      return m.device_class_damper();
    case "door":
      return m.device_class_door();
    case "garage":
      return m.device_class_garage();
    case "gate":
      return m.device_class_gate();
    case "shade":
      return m.device_class_shade();
    case "shutter":
      return m.device_class_shutter();
    case "window":
      return m.device_class_window();
    case "light":
      return m.device_class_light();
    case "switch":
      return m.device_class_switch();
    case "hidden":
      return m.device_class_hidden();
  }
}

interface ChannelFormProps {
  /** undefined → create mode; defined → edit mode */
  channel?: Channel;
  onSubmit: (data: {
    name: string;
    proto: "1way" | "2way";
    device_class: DeviceClass;
    mqtt_name: string;
    force_tilt_support?: boolean;
    bidirectional_feedback?: boolean;
    feedback_timeout_s?: number;
    external_remotes?: number[];
  }) => void;
  onCancel: () => void;
  /** Latest packet_rx from the WebSocket — used for the add-remote listening mode */
  lastPacketRx?: PacketInfo | null;
}

export function ChannelForm({ channel, onSubmit, onCancel, lastPacketRx }: ChannelFormProps) {
  const isEdit = channel !== undefined;
  const [name, setName] = useState(channel?.name ?? "");
  const [proto, setProto] = useState<"1way" | "2way">(channel?.proto ?? "1way");
  const [forceTilt, setForceTilt] = useState(channel?.force_tilt_support ?? false);
  const [bidirFeedback, setBidirFeedback] = useState(channel?.bidirectional_feedback ?? true);
  const [feedbackTimeout, setFeedbackTimeout] = useState(channel?.feedback_timeout_s ?? 120);
  const [deviceClass, setDeviceClass] = useState<DeviceClass>(channel?.device_class ?? "shutter");
  const [mqttName, setMqttName] = useState(channel?.mqtt_name ?? toMqttName(channel?.name ?? ""));
  const [mqttNameTouched, setMqttNameTouched] = useState(false);
  const [externalRemotes, setExternalRemotes] = useState<number[]>(channel?.external_remotes ?? []);
  const [listenMode, setListenMode] = useState(false);
  const prevPacketRxRef = useRef<PacketInfo | null | undefined>(undefined);

  useEffect(() => {
    if (!listenMode || !lastPacketRx) return;
    if (lastPacketRx === prevPacketRxRef.current) return;
    prevPacketRxRef.current = lastPacketRx;

    if (!lastPacketRx.valid || lastPacketRx.serial === undefined) return;
    if (!MOTION_CMDS.has(lastPacketRx.cmd ?? -1)) return;
    if (lastPacketRx.serial === channel?.serial) return;
    if (externalRemotes.includes(lastPacketRx.serial)) return;

    setExternalRemotes((prev) => [...prev, lastPacketRx.serial!]);
    setListenMode(false);
  }, [lastPacketRx, listenMode, externalRemotes, channel]);

  const handleRemoveRemote = (remoteSerial: number) => {
    setExternalRemotes((prev) => prev.filter((s) => s !== remoteSerial));
  };

  const handleNameChange = (newName: string) => {
    setName(newName);
    if (!mqttNameTouched || mqttName === toMqttName(name)) {
      setMqttName(toMqttName(newName));
      setMqttNameTouched(false);
    }
  };

  const handleMqttNameChange = (val: string) => {
    setMqttName(val);
    setMqttNameTouched(val !== toMqttName(name));
  };

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit({
      name: trimmed,
      proto,
      device_class: deviceClass,
      mqtt_name: mqttName || toMqttName(trimmed),
      ...(isEdit && {
        force_tilt_support: forceTilt,
        bidirectional_feedback: bidirFeedback,
        feedback_timeout_s: feedbackTimeout,
        external_remotes: externalRemotes,
      }),
    });
  };

  return (
    <div class="bg-zinc-900 rounded border border-zinc-700 p-2 mb-2">
      <p class="text-zinc-400 text-xs font-semibold mb-2">
        {isEdit ? m.form_edit_channel({ name: channel!.name }) : m.form_new_channel()}
      </p>

      <FieldLabel>{m.form_channel_name_label()}</FieldLabel>
      <input
        type="text"
        placeholder={m.form_channel_name_placeholder()}
        value={name}
        maxLength={32}
        onInput={(e) => handleNameChange((e.target as HTMLInputElement).value)}
        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        class="w-full bg-zinc-800 text-zinc-100 border border-zinc-600 rounded px-2 py-1 text-xs mb-2 font-mono"
      />

      <FieldLabel>{m.form_protocol_label()}</FieldLabel>
      <select
        value={proto}
        onChange={(e) => setProto((e.target as HTMLSelectElement).value as "1way" | "2way")}
        class="w-full bg-zinc-800 text-zinc-100 border border-zinc-600 rounded px-2 py-1 text-xs mb-2"
      >
        <option value="1way">COSMO</option>
        <option value="2way">COSMO 2WAY</option>
      </select>

      <FieldLabel>{m.form_device_class_label()}</FieldLabel>
      <select
        value={deviceClass}
        onChange={(e) => setDeviceClass((e.target as HTMLSelectElement).value as DeviceClass)}
        class="w-full bg-zinc-800 text-zinc-100 border border-zinc-600 rounded px-2 py-1 text-xs mb-2"
      >
        {DEVICE_CLASS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {deviceClassLabel(o.value)}
          </option>
        ))}
      </select>

      <FieldLabel>{m.form_mqtt_name_label()}</FieldLabel>
      <input
        type="text"
        placeholder="mqtt_name"
        value={mqttName}
        maxLength={63}
        onInput={(e) => handleMqttNameChange((e.target as HTMLInputElement).value)}
        class="w-full bg-zinc-800 text-zinc-100 border border-zinc-600 rounded px-2 py-1 text-xs mb-2 font-mono"
      />

      {isEdit && proto === "2way" && (
        <label class="flex items-center gap-2 text-xs text-zinc-300 mb-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={forceTilt}
            onChange={(e) => setForceTilt((e.target as HTMLInputElement).checked)}
            class="accent-blue-500"
          />
          {m.form_force_tilt()}
        </label>
      )}

      {isEdit && (
        <>
          <label class="flex items-center gap-2 text-xs text-zinc-300 mb-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={bidirFeedback}
              onChange={(e) => setBidirFeedback((e.target as HTMLInputElement).checked)}
              class="accent-blue-500"
            />
            {m.form_bidirectional_feedback()}
          </label>
          <div class={!bidirFeedback ? "opacity-40 pointer-events-none" : ""}>
            <FieldLabel>{m.form_feedback_timeout_label()}</FieldLabel>
            <input
              type="number"
              min={0}
              max={3600}
              disabled={!bidirFeedback}
              value={feedbackTimeout}
              onInput={(e) =>
                setFeedbackTimeout(
                  Math.min(3600, Math.max(0, parseInt((e.target as HTMLInputElement).value) || 0)),
                )
              }
              class="w-full bg-zinc-800 text-zinc-100 border border-zinc-600 rounded px-2 py-1 text-xs mb-2"
            />
          </div>
        </>
      )}

      {isEdit && (
        <div class="mb-2">
          <FieldLabel>{m.form_external_remotes_label()}</FieldLabel>

          {externalRemotes.length > 0 && (
            <div class="flex flex-col gap-0.5 mb-1">
              {externalRemotes.map((serial) => (
                <div
                  key={serial}
                  class="flex items-center justify-between bg-zinc-800 rounded px-2 py-1 text-xs font-mono"
                >
                  <span class="text-zinc-300">
                    0x{serial.toString(16).toUpperCase().padStart(8, "0")}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveRemote(serial)}
                    class="text-zinc-500 hover:text-red-400 transition-colors cursor-pointer bg-transparent border-0 p-0 flex items-center"
                    title={m.form_remove_remote()}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {listenMode ? (
            <div class="flex flex-col gap-1">
              <div class="flex items-center gap-1.5 text-xs text-amber-300 bg-amber-950 border border-amber-800 rounded px-2 py-1.5">
                <Radio size={12} class="shrink-0 animate-pulse" />
                {m.form_listen_hint()}
              </div>
              <Button onClick={() => setListenMode(false)} class="w-full text-xs">
                {m.cancel()}
              </Button>
            </div>
          ) : (
            <Button
              onClick={() => {
                prevPacketRxRef.current = lastPacketRx;
                setListenMode(true);
              }}
              class="w-full text-xs flex items-center justify-center gap-1"
            >
              <Plus size={12} /> {m.form_add_remote()}
            </Button>
          )}
        </div>
      )}

      <div class="flex gap-1">
        <Button variant="primary" disabled={!name.trim()} onClick={handleSubmit} class="flex-1">
          {isEdit ? m.form_save() : m.form_create()}
        </Button>
        <Button onClick={onCancel} class="flex-1">
          {m.cancel()}
        </Button>
      </div>
    </div>
  );
}
