import { useState } from "preact/hooks";
import {
  ChevronUp,
  ChevronDown,
  Square,
  RotateCw,
  RotateCcw,
  Hourglass,
  CircleAlert,
  Power,
  PowerOff,
  Menu,
  Pencil,
  Trash2,
  CircleHelp,
} from "lucide-preact";
import { Button } from "./ui/Button";
import { Collapsible } from "./ui/Collapsible";
import { Dropdown } from "./ui/Dropdown";
import { ParaglideMessage } from "@inlang/paraglide-js-react";
import { Alert } from "./ui/Alert";
import { Modal } from "./ui/Modal";
import { ChannelForm } from "./ChannelForm";
import { rssiToSignalIcon } from "./icons";
import { Channel, ChannelState } from "./channelTypes";
import { PacketInfo } from "./wsTypes";
import { m } from "./paraglide/messages.js";

/* ── State display ───────────────────────────────────────────────────────── */

function stateLabel(state: ChannelState): string {
  switch (state) {
    case "unknown":
      return m.state_unknown();
    case "closing":
      return m.state_closing();
    case "closed":
      return m.state_closed();
    case "opening":
      return m.state_opening();
    case "open":
      return m.state_open();
    case "comfort":
      return m.state_comfort();
    case "partially_open":
      return m.state_partially_open();
    case "obstruction":
      return m.state_obstruction();
    case "in_motion":
      return m.state_in_motion();
  }
}

const STATE_CHIP_CLASS: Record<ChannelState, string> = {
  unknown: "bg-zinc-800 text-zinc-400 border-zinc-700",
  closing: "bg-amber-950 text-amber-300 border-amber-800",
  closed: "bg-sky-950 text-sky-300 border-sky-800",
  opening: "bg-amber-950 text-amber-300 border-amber-800",
  open: "bg-green-950 text-green-300 border-green-800",
  comfort: "bg-lime-950 text-lime-300 border-lime-800",
  partially_open: "bg-orange-950 text-orange-300 border-orange-800",
  obstruction: "bg-red-950 text-red-300 border-red-800",
  in_motion: "bg-yellow-950 text-yellow-200 border-yellow-800",
};

/* ── Time formatting ─────────────────────────────────────────────────────── */

export function formatLastSeen(ts: number): string {
  if (!ts) return m.time_never();
  const diff = Math.floor(Date.now() / 1000 - ts);
  if (diff < 5) return m.time_just_now();
  if (diff < 60) return m.time_seconds_ago({ n: diff });
  if (diff < 3600) return m.time_minutes_ago({ n: Math.floor(diff / 60) });
  return m.time_hours_ago({ n: Math.floor(diff / 3600) });
}

/* ── Extra / advanced button definitions ─────────────────────────────────── */

const getExtraCmdRows = (): { label: string; value: string }[][] => [
  [
    { label: m.cmd_prog(), value: "PROG" },
    { label: m.cmd_stop_up(), value: "STOP_UP" },
  ],
  [
    { label: m.cmd_up_down(), value: "UP_DOWN" },
    { label: m.cmd_stop_down(), value: "STOP_DOWN" },
  ],
  [
    { label: m.cmd_stop_hold(), value: "STOP_HOLD" },
    { label: m.cmd_request_position(), value: "REQUEST_POSITION" },
  ],
];

const getPayloadCmds = (): { label: string; value: string; max: number }[] => [
  { label: m.cmd_set_position(), value: "SET_POSITION", max: 100 },
  { label: m.cmd_set_tilt(), value: "SET_TILT", max: 255 },
  { label: m.cmd_request_feedback(), value: "REQUEST_FEEDBACK", max: 255 },
];

/* ── Sub-components ──────────────────────────────────────────────────────── */

function StateChip({ ch }: { ch: Channel }) {
  const label = stateLabel(ch.state);
  const chipCls = STATE_CHIP_CLASS[ch.state];
  const SignalIcon = ch.last_seen_ts ? rssiToSignalIcon(ch.rssi) : CircleHelp;
  const timeStr = ch.last_seen_ts ? formatLastSeen(ch.last_seen_ts) : "-";

  return (
    <span class="inline-flex items-stretch rounded border border-zinc-700 text-xs overflow-hidden">
      <span class={`px-2 py-0.5 flex items-center gap-1 border-r border-zinc-700 ${chipCls}`}>
        {label}
        {ch.state === "partially_open" && ch.position !== null && ch.position !== undefined && (
          <span class="font-bold">{ch.position}%</span>
        )}
        {ch.state_type === "optimistic" && (
          <span
            class={`inline-flex items-center text-current opacity-70 ${
              ch.state === "opening" || ch.state === "closing" || ch.state === "in_motion"
                ? "hourglass-spinning"
                : ""
            }`}
            title={m.state_optimistic_title()}
          >
            <Hourglass size={10} />
          </span>
        )}
        {ch.state_type === "timed_out" && (
          <span
            class="inline-flex items-center text-red-400 opacity-90"
            title={m.state_timed_out_title()}
          >
            <CircleAlert size={10} />
          </span>
        )}
      </span>
      <span class="px-1.5 py-0.5 bg-zinc-800 text-zinc-400 flex items-center gap-1">
        <SignalIcon size={11} />
        {timeStr}
      </span>
    </span>
  );
}

function ControlButton({
  onClick,
  title,
  variant = "secondary",
  children,
}: {
  onClick: () => void;
  title: string;
  variant?: "primary" | "secondary" | "danger";
  children: preact.ComponentChildren;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      class={`
        w-[60px] h-[60px] flex items-center justify-center rounded cursor-pointer border-0 text-zinc-100
        ${variant === "primary" ? "bg-blue-900 hover:bg-blue-800" : ""}
        ${variant === "secondary" ? "bg-zinc-700 hover:bg-zinc-600" : ""}
        ${variant === "danger" ? "bg-red-900  hover:bg-red-800" : ""}
      `}
    >
      {children}
    </button>
  );
}

function ControlGrid({
  sendCmd,
  hasTilt,
}: {
  sendCmd: (cmd: string, extra?: number) => void;
  hasTilt: boolean;
}) {
  const empty = <div class="w-[60px] h-[60px]" />;
  return (
    <div class="grid grid-cols-3 gap-1 w-fit">
      {empty}
      <ControlButton onClick={() => sendCmd("UP")} title={m.btn_up()} variant="primary">
        <ChevronUp size={28} />
      </ControlButton>
      {empty}

      {hasTilt ? (
        <ControlButton
          onClick={() => sendCmd("TILT_INCREASE")}
          title={m.btn_tilt_increase()}
          variant="secondary"
        >
          <RotateCw size={22} />
        </ControlButton>
      ) : (
        empty
      )}
      <ControlButton onClick={() => sendCmd("STOP")} title={m.btn_stop()} variant="secondary">
        <Square size={22} />
      </ControlButton>
      {hasTilt ? (
        <ControlButton
          onClick={() => sendCmd("TILT_DECREASE")}
          title={m.btn_tilt_decrease()}
          variant="secondary"
        >
          <RotateCcw size={22} />
        </ControlButton>
      ) : (
        empty
      )}

      {empty}
      <ControlButton onClick={() => sendCmd("DOWN")} title={m.btn_down()} variant="danger">
        <ChevronDown size={28} />
      </ControlButton>
      {empty}
    </div>
  );
}

function LightSwitchControls({ sendCmd }: { sendCmd: (cmd: string) => void }) {
  return (
    <div class="flex gap-3 justify-center mb-1">
      <ControlButton onClick={() => sendCmd("UP")} title={m.btn_power_on()} variant="primary">
        <Power size={24} />
      </ControlButton>
      <ControlButton onClick={() => sendCmd("DOWN")} title={m.btn_power_off()} variant="danger">
        <PowerOff size={24} />
      </ControlButton>
    </div>
  );
}

/* ── Main ChannelCard ────────────────────────────────────────────────────── */

interface ChannelCardProps {
  ch: Channel;
  onSend: (msg: object) => void;
  lastPacketRx: PacketInfo | null;
}

export function ChannelCard({ ch, onSend, lastPacketRx }: ChannelCardProps) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [payloadValues, setPayloadValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(getPayloadCmds().map((c) => [c.value, 0])),
  );

  const sendCmd = (cmd_name: string, extra_payload?: number) =>
    onSend({
      cmd: "channel_cmd",
      serial: ch.serial,
      cmd_name,
      ...(extra_payload !== undefined && { extra_payload }),
    });

  const handleEdit = (data: {
    name: string;
    proto: "1way" | "2way";
    device_class: string;
    mqtt_name: string;
    force_tilt_support?: boolean;
    bidirectional_feedback?: boolean;
    feedback_timeout_s?: number;
    external_remotes?: number[];
  }) => {
    onSend({ cmd: "update_channel", serial: ch.serial, ...data });
    setEditing(false);
  };

  const handleDelete = () => {
    onSend({ cmd: "delete_channel", serial: ch.serial });
    setConfirmDelete(false);
  };

  const hasTilt = ch.proto === "2way" && (ch.reports_tilt_support || ch.force_tilt_support);
  const isLightSwitch = ch.device_class === "light" || ch.device_class === "switch";

  const dropdownItems = [
    {
      label: m.menu_edit(),
      icon: <Pencil size={12} />,
      onClick: () => setEditing((v) => !v),
    },
    {
      label: m.menu_delete(),
      icon: <Trash2 size={12} />,
      danger: true,
      onClick: () => setConfirmDelete(true),
    },
  ];

  return (
    <div class="bg-zinc-900 rounded border border-zinc-800 p-3 mb-2">
      {/* Header row: name + state chip + menu */}
      <div class="flex items-center gap-2 mb-2">
        <span class="flex-1 font-bold text-sm truncate">{ch.name}</span>
        <StateChip ch={ch} />
        <Dropdown trigger={<Menu size={14} />} items={dropdownItems} />
      </div>

      {/* Pairing instructions — shown when bidirectional feedback is on but device not yet seen */}
      {ch.bidirectional_feedback && !ch.last_seen_ts && (
        <Alert variant="info" class="mb-2">
          <div>
            <p class="font-semibold mb-1">{m.pairing_instructions_title()}</p>
            <Collapsible label={m.pairing_instructions_show_steps()}>
              <ol class="list-decimal list-inside space-y-1 mt-1">
                <li>{m.pairing_instructions_step_1()}</li>
                <li>{m.pairing_instructions_step_2()}</li>
                <li>{m.pairing_instructions_step_3()}</li>
              </ol>
              <p class="mt-2 opacity-75">
                <ParaglideMessage
                  message={m.pairing_instructions_more_info}
                  inputs={{}}
                  markup={{
                    a: ({ children }) => (
                      <a
                        href="https://alufers.github.io/uni-gtw/docs/usage/pairing_devices"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="underline"
                      >
                        {children}
                      </a>
                    ),
                  }}
                />
              </p>
            </Collapsible>
          </div>
        </Alert>
      )}

      {/* Edit form */}
      {editing && (
        <ChannelForm
          channel={ch}
          onSubmit={handleEdit}
          onCancel={() => setEditing(false)}
          lastPacketRx={lastPacketRx}
        />
      )}

      {/* Controls */}
      {isLightSwitch ? (
        <LightSwitchControls sendCmd={sendCmd} />
      ) : (
        <div class="flex justify-center mb-1">
          <ControlGrid sendCmd={sendCmd} hasTilt={hasTilt} />
        </div>
      )}

      {/* Advanced collapsible */}
      <Collapsible label={m.label_advanced()}>
        {/* Meta info moved here */}
        <div class="text-xs mb-2 pb-1 border-b border-zinc-800 flex flex-col gap-0.5">
          <div class="flex items-center gap-2">
            <span class="text-zinc-500 w-16 shrink-0">{m.label_protocol()}</span>
            <span class="text-zinc-300">{ch.proto === "2way" ? "COSMO 2WAY" : "COSMO"}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-zinc-500 w-16 shrink-0">{m.label_counter()}</span>
            <span class="text-zinc-300">{ch.counter}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-zinc-500 w-16 shrink-0">{m.label_serial()}</span>
            <span class="text-zinc-300 font-mono">
              0x{ch.serial.toString(16).toUpperCase().padStart(8, "0")}
            </span>
          </div>
          {ch.last_seen_ts > 0 && (
            <div class="flex items-center gap-2">
              <span class="text-zinc-500 w-16 shrink-0">{m.label_rssi()}</span>
              <span class="text-zinc-300 font-mono">{ch.rssi} dBm</span>
            </div>
          )}
        </div>

        {/* Stop button for light/switch (moved out of main controls) */}
        {isLightSwitch && (
          <Button variant="secondary" onClick={() => sendCmd("STOP")} class="w-full mb-1">
            {m.btn_stop()}
          </Button>
        )}

        {/* Extra command button grid */}
        {getExtraCmdRows().map((row, ri) => (
          <div key={ri} class="flex gap-1">
            {row.map((c) => (
              <Button
                key={c.value}
                variant="secondary"
                onClick={() => sendCmd(c.value)}
                class="flex-1"
              >
                {c.label}
              </Button>
            ))}
            {row.length === 1 && <div class="flex-1" />}
          </div>
        ))}

        {/* Payload commands — 2-way only; SET_POSITION hidden for 1-way */}
        {ch.proto === "2way" &&
          getPayloadCmds()
            .filter((c) => c.value !== "SET_TILT" || hasTilt)
            .map((c) => (
              <div key={c.value} class="flex gap-1">
                <Button
                  variant="secondary"
                  onClick={() => sendCmd(c.value, payloadValues[c.value])}
                  class="flex-1"
                >
                  {c.label}
                </Button>
                <input
                  type="number"
                  min={0}
                  max={c.max}
                  value={payloadValues[c.value]}
                  onInput={(e) =>
                    setPayloadValues((prev) => ({
                      ...prev,
                      [c.value]: Math.min(
                        c.max,
                        Math.max(0, parseInt((e.target as HTMLInputElement).value) || 0),
                      ),
                    }))
                  }
                  class="w-16 bg-zinc-800 text-zinc-100 border border-zinc-600 rounded px-1 py-1 text-xs text-center"
                />
              </div>
            ))}
      </Collapsible>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <Modal
          title={m.delete_channel_title()}
          okLabel={m.delete()}
          onOk={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        >
          <p class="text-sm text-zinc-300 leading-relaxed">{m.delete_channel_warning()}</p>
          <p class="text-xs text-zinc-500 mt-2">
            {m.delete_channel_serial_prefix()}{" "}
            <span class="font-mono">0x{ch.serial.toString(16).toUpperCase().padStart(8, "0")}</span>
          </p>
        </Modal>
      )}
    </div>
  );
}
