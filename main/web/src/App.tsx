import { useContext, useEffect, useRef, useState } from "preact/hooks";
import { Terminal, X } from "lucide-preact";
import { AuthContext } from "./AuthContext";
import { m } from "./paraglide/messages.js";
import { AuthGuard } from "./AuthGuard";
import { Console } from "./Console";
import { Channels } from "./Channels";
import { Channel } from "./channelTypes";
import { About } from "./About";
import { Settings } from "./settings/Settings";
import { Ota } from "./Ota";
import { Tabs } from "./ui/Tabs";
import { TopBar } from "./TopBar";
import { useJsonWebsocket, ReadyState } from "./useWebsocket";
import { WifiModal } from "./WifiModal";
import {
  WsMessage,
  StatusPayload,
  ScanEntry,
  RadioStatus,
  MqttStatus,
  PacketInfo,
  OtaProgressPayload,
} from "./wsTypes";

const getTabs = () => [
  { id: "control", label: m.tab_control() },
  { id: "settings", label: m.tab_settings() },
  { id: "ota", label: m.tab_ota() },
  { id: "about", label: m.tab_about() },
];

export function App() {
  return (
    <AuthGuard>
      <AppInner />
    </AuthGuard>
  );
}

function AppInner() {
  const { password, onLogout, hostname, chip, version } = useContext(AuthContext);
  const [lines, setLines] = useState<string[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [scanResults, setScanResults] = useState<ScanEntry[] | null>(null);
  const [showWifiModal, setShowWifiModal] = useState(false);
  const [activeTab, setActiveTab] = useState("control");
  const [showConsole, setShowConsole] = useState(false);
  const [radioFlash, setRadioFlash] = useState(false);
  const [lastPacketRx, setLastPacketRx] = useState<PacketInfo | null>(null);
  const [otaProgress, setOtaProgress] = useState<OtaProgressPayload | null>(null);
  const wifiDismissedRef = useRef(false);
  const lastStatusTimeRef = useRef<number>(0);
  const radioFlashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const base = hostname || "uni-gtw";
    document.title = version ? `${base} (${version})` : base;
  }, [hostname, version]);

  const wsUrl = password
    ? `ws://${location.host}/ws?auth=${encodeURIComponent(password)}`
    : `ws://${location.host}/ws`;
  const { lastJsonMessage, sendJsonMessage, readyState, forceReconnect } =
    useJsonWebsocket<WsMessage>(wsUrl);

  useEffect(() => {
    if (!lastJsonMessage) return;
    if (lastJsonMessage.cmd === "console") {
      setLines((prev) => [...prev, lastJsonMessage.payload]);
    } else if (lastJsonMessage.cmd === "channels") {
      setChannels(lastJsonMessage.payload);
    } else if (lastJsonMessage.cmd === "channel_update") {
      const updated = lastJsonMessage.payload;
      setChannels((prev) => {
        const idx = prev.findIndex((c) => c.serial === updated.serial);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = updated;
          return next;
        }
        return [...prev, updated];
      });
    } else if (lastJsonMessage.cmd === "channel_deleted") {
      const { serial } = lastJsonMessage;
      setChannels((prev) => prev.filter((c) => c.serial !== serial));
    } else if (lastJsonMessage.cmd === "status") {
      lastStatusTimeRef.current = Date.now();
      setStatus(lastJsonMessage.payload);
      if (lastJsonMessage.payload.wifi_mode === "ap" && !wifiDismissedRef.current) {
        setShowWifiModal(true);
      }
    } else if (lastJsonMessage.cmd === "wifi_scan_result") {
      setScanResults(lastJsonMessage.payload);
    } else if (lastJsonMessage.cmd === "packet_rx" || lastJsonMessage.cmd === "packet_tx") {
      if (radioFlashTimeoutRef.current) clearTimeout(radioFlashTimeoutRef.current);
      setRadioFlash(true);
      radioFlashTimeoutRef.current = setTimeout(() => setRadioFlash(false), 300);
      if (lastJsonMessage.cmd === "packet_rx") {
        setLastPacketRx(lastJsonMessage.payload);
      }
    } else if (lastJsonMessage.cmd === "ota_progress") {
      setOtaProgress(lastJsonMessage.payload);
    }
  }, [lastJsonMessage]);

  useEffect(() => {
    if (readyState === ReadyState.OPEN) {
      setLines([]);
      setStatus(null);
      lastStatusTimeRef.current = 0;
    } else if (readyState === ReadyState.CLOSED) {
      setLines((prev) => [...prev, "[disconnected]"]);
      setStatus(null);
    }
  }, [readyState]);

  useEffect(() => {
    if (readyState !== ReadyState.OPEN) return;
    const interval = setInterval(() => {
      if (lastStatusTimeRef.current > 0 && Date.now() - lastStatusTimeRef.current > 20_000) {
        forceReconnect();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [readyState, forceReconnect]);

  const radioStatus: RadioStatus | null = status?.radio_status ?? null;
  const mqttStatus: MqttStatus | null = status?.mqtt_status ?? null;
  const connected = readyState === ReadyState.OPEN;
  const connecting = readyState === ReadyState.CONNECTING;

  const goToSettings = () => setActiveTab("settings");

  const consoleToggle = (
    <button
      onClick={() => setShowConsole((v) => !v)}
      title={showConsole ? m.console_hide_title() : m.console_show_title()}
      class={`px-3 py-2 text-xs font-medium border-b-2 cursor-pointer bg-transparent border-l-0 border-r-0 border-t-0 transition-colors flex items-center gap-1.5 ${
        showConsole
          ? "border-blue-500 text-blue-400"
          : "border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-600"
      }`}
    >
      <Terminal size={13} />
      {m.console()}
    </button>
  );

  return (
    <div class="flex flex-col h-full bg-zinc-950 text-zinc-100 font-mono">
      <TopBar
        status={status}
        connected={connected}
        connecting={connecting}
        radioStatus={radioStatus}
        mqttStatus={mqttStatus}
        radioFlash={radioFlash}
        hostname={hostname}
        chip={chip}
        version={version}
        onGoToSettings={goToSettings}
        onOpenWifiModal={() => setShowWifiModal(true)}
        onLogout={password !== null ? onLogout : undefined}
      />

      {/* Tab bar with console toggle on the right */}
      <Tabs tabs={getTabs()} active={activeTab} onChange={setActiveTab} rightSlot={consoleToggle} />

      {/* Main content + optional console */}
      <div class="flex flex-1 overflow-hidden relative">
        {/* Main view — hidden behind console on mobile when console is open */}
        <div class={`flex-1 overflow-hidden ${showConsole ? "hidden md:block" : ""}`}>
          {activeTab === "control" ? (
            <Channels
              channels={channels}
              onSend={sendJsonMessage}
              radioStatus={radioStatus}
              onGoToSettings={goToSettings}
              lastPacketRx={lastPacketRx}
            />
          ) : activeTab === "settings" ? (
            <Settings />
          ) : activeTab === "ota" ? (
            <Ota otaProgress={otaProgress} />
          ) : (
            <About />
          )}
        </div>

        {/* Console — full-screen overlay on mobile, sidebar on desktop */}
        {showConsole && (
          <div class="absolute inset-0 z-20 flex flex-col bg-zinc-950 md:relative md:inset-auto md:z-auto md:w-[500px] md:shrink-0 md:border-l md:border-zinc-800">
            {/* Close button visible only on mobile */}
            <button
              class="md:hidden flex items-center gap-1.5 px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200 border-b border-zinc-800 bg-transparent border-l-0 border-r-0 border-t-0 cursor-pointer self-end"
              onClick={() => setShowConsole(false)}
            >
              <X size={13} />
              {m.console_hide_title()}
            </button>
            <Console lines={lines} />
          </div>
        )}
      </div>

      {/* WiFi modal */}
      {showWifiModal && (
        <WifiModal
          onClose={() => {
            wifiDismissedRef.current = true;
            setShowWifiModal(false);
            setScanResults(null);
          }}
          onSubmit={(ssid, pass) =>
            sendJsonMessage({
              cmd: "wifi_set_credentials",
              ssid,
              password: pass,
            })
          }
          onScan={() => {
            setScanResults(null);
            sendJsonMessage({ cmd: "wifi_scan" });
          }}
          scanResults={scanResults}
        />
      )}
    </div>
  );
}
