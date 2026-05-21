import React, { useState, useRef, useEffect } from "react";
import BrowserOnly from "@docusaurus/BrowserOnly";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import { usePluginData } from "@docusaurus/useGlobalData";
import { ESPLoader, Transport } from "esptool-js";
import type { LoaderOptions, IEspLoaderTerminal } from "esptool-js";
import { encodeNVS } from "esp-nvs-utils";
import { decodePartitionTable } from "esp-partition-utils";
import { Plug, Unplug, Zap } from "lucide-react";

interface ManifestPart {
  path: string;
  offset: number;
}

interface ManifestBuild {
  chipFamily: string;
  parts: ManifestPart[];
}

interface Manifest {
  name: string;
  version: string;
  builds: ManifestBuild[];
}

interface ReleaseInfo {
  tag: string;
  name: string;
  publishedAt: string;
  prerelease: boolean;
  manifestPath: string;
  releaseUrl: string;
}

interface HardwarePresetOption {
  id: number;
  label: string;
}

const PRESETS_BY_CHIP: Record<string, HardwarePresetOption[]> = {
  "ESP32-C3": [{ id: 1, label: "alufers esp-cc1101-board" }],
  "ESP32-S3": [
    { id: 2, label: "Heltec WiFi LoRa 32 V4" },
    { id: 3, label: "XIAO ESP32S3 + Wio-SX1262" },
  ],
};

function getPresetChip(presetId: number): string | null {
  for (const [chip, presets] of Object.entries(PRESETS_BY_CHIP)) {
    if (presets.some((p) => p.id === presetId)) return chip;
  }
  return null;
}

type Phase =
  | "idle"
  | "connecting"
  | "connected"
  | "flashing"
  | "done"
  | "error";

const LABEL_STYLE: React.CSSProperties = {
  display: "block",
  marginBottom: "6px",
  fontWeight: 600,
  fontSize: "0.75em",
  color: "var(--ifm-color-emphasis-600)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

const SELECT_STYLE: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  fontSize: "0.9375em",
  borderRadius: "var(--ifm-global-radius)",
  border: "1px solid var(--ifm-color-emphasis-300)",
  background: "var(--ifm-background-surface-color)",
  color: "var(--ifm-font-color-base)",
  appearance: "auto",
  outline: "none",
};

function FlasherPanel({
  releases,
  baseUrl,
}: {
  releases: ReleaseInfo[];
  baseUrl: string;
}) {
  const transportRef = useRef<Transport | null>(null);
  const espLoaderRef = useRef<ESPLoader | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [chipFamily, setChipFamily] = useState<string>("");
  const [chipDescription, setChipDescription] = useState<string>("");
  const [selectedPresetId, setSelectedPresetId] = useState<number>(-1);
  const [eraseAll, setEraseAll] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [log, setLog] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [selectedTag, setSelectedTag] = useState<string>(
    releases[0]?.tag ?? ""
  );

  const logRef = useRef<string[]>([]);
  const logScrollRef = useRef<HTMLPreElement | null>(null);

  useEffect(() => {
    if (logScrollRef.current) {
      logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight;
    }
  }, [log]);

  const terminal: IEspLoaderTerminal = {
    clean() {
      logRef.current = [];
      setLog([]);
    },
    writeLine(data: string) {
      logRef.current = [...logRef.current, data];
      setLog([...logRef.current]);
    },
    write(data: string) {
      const prev = logRef.current;
      const last = prev[prev.length - 1] ?? "";
      logRef.current = [...prev.slice(0, -1), last + data];
      setLog([...logRef.current]);
    },
  };

  async function safeDisconnect() {
    try {
      await transportRef.current?.disconnect();
    } catch {
      // best-effort
    }
    transportRef.current = null;
    espLoaderRef.current = null;
  }

  function appendLog(line: string) {
    logRef.current = [...logRef.current, line];
    setLog([...logRef.current]);
  }

  async function handleConnect() {
    if (!("serial" in navigator)) {
      setErrorMsg(
        "WebSerial is not supported. Use Chrome or Edge on a desktop/laptop."
      );
      setPhase("error");
      return;
    }
    setPhase("connecting");
    logRef.current = [];
    setLog([]);
    setErrorMsg("");
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const port = await (navigator as any).serial.requestPort();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transport = new Transport(port as any, true);
      transportRef.current = transport;
      const loader = new ESPLoader({
        transport,
        baudrate: 921600,
        terminal,
      } as LoaderOptions);
      espLoaderRef.current = loader;
      const desc = await loader.main();
      setChipDescription(desc);
      setChipFamily(loader.chip.CHIP_NAME);
      setSelectedPresetId(-1);
      setPhase("connected");
    } catch (err) {
      setErrorMsg(String(err));
      setPhase("error");
      await safeDisconnect();
    }
  }

  async function handleDisconnect() {
    await safeDisconnect();
    setPhase("idle");
    setChipFamily("");
    setChipDescription("");
  }

  async function handleFlash() {
    const release = releases.find((r) => r.tag === selectedTag);
    if (!release || !espLoaderRef.current) return;

    setPhase("flashing");
    setProgress(0);
    logRef.current = [];
    setLog([]);
    setErrorMsg("");

    try {
      const manifestUrl = `${baseUrl}${release.manifestPath}`;
      appendLog(`Fetching manifest for ${selectedTag}…`);
      const manifest: Manifest = await fetch(manifestUrl).then((r) => {
        if (!r.ok) throw new Error(`Manifest fetch failed: ${r.status}`);
        return r.json() as Promise<Manifest>;
      });

      const build = manifest.builds.find(
        (b) => b.chipFamily.toUpperCase() === chipFamily.toUpperCase()
      );
      if (!build)
        throw new Error(`No firmware build found for chip ${chipFamily}`);

      const manifestBase =
        manifestUrl.substring(0, manifestUrl.lastIndexOf("/") + 1);

      const fileArray: { data: Uint8Array; address: number }[] = [];
      let partTableData: Uint8Array | null = null;

      appendLog(`Downloading ${build.parts.length} firmware parts…`);
      for (const part of build.parts) {
        appendLog(`  ${part.path}`);
        const resp = await fetch(manifestBase + part.path);
        if (!resp.ok)
          throw new Error(`Failed to fetch ${part.path}: ${resp.status}`);
        const data = new Uint8Array(await resp.arrayBuffer());
        fileArray.push({ data, address: part.offset });
        if (part.path.includes("partition-table")) {
          partTableData = data;
        }
      }

      if (selectedPresetId !== -1) {
        if (!partTableData) {
          throw new Error("partition-table part not found in manifest");
        }
        appendLog(
          `Generating NVS partition for hardware preset ${selectedPresetId}…`
        );
        const partitions = decodePartitionTable(partTableData);
        const nvsPart = partitions.find(
          (p) => p.type === "data" && p.subtype === "nvs"
        );
        if (!nvsPart || nvsPart.offset === null || nvsPart.size === null) {
          throw new Error("NVS partition not found in partition table");
        }
        const encoded = encodeNVS({
          boot: [
            { name: "hw_preset", encoding: "i32", value: selectedPresetId },
          ],
        });
        if (encoded.length > nvsPart.size) {
          throw new Error(
            `NVS data (${encoded.length} B) exceeds partition size (${nvsPart.size} B)`
          );
        }
        const paddedNVS = new Uint8Array(nvsPart.size).fill(0xff);
        paddedNVS.set(encoded, 0);
        fileArray.push({ data: paddedNVS, address: nvsPart.offset });
        appendLog(
          `  NVS at 0x${nvsPart.offset.toString(16)} (${nvsPart.size} bytes)`
        );
      }

      appendLog(eraseAll ? "Erasing flash…" : "Flashing…");
      const totalFiles = fileArray.length;
      await espLoaderRef.current.writeFlash({
        fileArray,
        flashMode: "keep",
        flashFreq: "keep",
        flashSize: "keep",
        eraseAll,
        compress: true,
        reportProgress(fileIndex: number, written: number, total: number) {
          setProgress(
            Math.round(((fileIndex + written / total) / totalFiles) * 100)
          );
        },
      });

      appendLog("Resetting device…");
      await espLoaderRef.current.after("hard_reset");
      await safeDisconnect();
      setPhase("done");
      setProgress(100);
      appendLog("Done.");
    } catch (err) {
      setErrorMsg(String(err));
      setPhase("error");
      await safeDisconnect();
    }
  }

  useEffect(() => {
    return () => {
      safeDisconnect();
    };
  }, []);

  const isConnected = phase === "connected";
  const isFlashing = phase === "flashing";
  const isBusy = phase === "connecting" || isFlashing;
  const selectedRelease = releases.find((r) => r.tag === selectedTag);

  const presetChip = selectedPresetId !== -1 ? getPresetChip(selectedPresetId) : null;
  const isPresetIncompatible =
    isConnected &&
    presetChip !== null &&
    chipFamily !== "" &&
    presetChip !== chipFamily;

  const canFlash = isConnected && !isFlashing && !isPresetIncompatible;

  return (
    <div
      className="card"
      style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}
    >
      <div
        className="card__body"
        style={{ display: "flex", flexDirection: "column", gap: "1rem", paddingBottom: "1.25rem" }}
      >
        {/* Firmware version */}
        <div>
          <label style={LABEL_STYLE}>Firmware version</label>
          <div style={{ display: "flex", gap: "0.625rem", alignItems: "center" }}>
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              disabled={isBusy || isConnected}
              style={{ ...SELECT_STYLE, flex: "1 1 auto" }}
            >
              {releases.map((r) => {
                const date = new Date(r.publishedAt).toLocaleDateString(
                  "en-US",
                  { year: "numeric", month: "short", day: "numeric" }
                );
                return (
                  <option key={r.tag} value={r.tag}>
                    {r.tag} — {date}
                    {r.prerelease ? " (pre-release)" : ""}
                  </option>
                );
              })}
            </select>
            {selectedRelease && (
              <a
                href={selectedRelease.releaseUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ whiteSpace: "nowrap", fontSize: "0.875em" }}
              >
                Release notes ↗
              </a>
            )}
          </div>
        </div>

        {/* Hardware preset */}
        <div>
          <label style={LABEL_STYLE}>
            Hardware preset{" "}
            <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, opacity: 0.7 }}>
              (optional)
            </span>
          </label>
          <select
            value={selectedPresetId}
            onChange={(e) => setSelectedPresetId(Number(e.target.value))}
            disabled={isBusy}
            style={SELECT_STYLE}
          >
            <option value={-1}>No preset</option>
            {Object.entries(PRESETS_BY_CHIP).map(([chip, presets]) => (
              <optgroup key={chip} label={chip}>
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Full flash erase */}
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            cursor: isBusy ? "not-allowed" : "pointer",
            userSelect: "none",
            width: "fit-content",
            opacity: isBusy ? 0.5 : 1,
          }}
        >
          <input
            type="checkbox"
            checked={eraseAll}
            onChange={(e) => setEraseAll(e.target.checked)}
            disabled={isBusy}
          />
          <span style={{ fontSize: "0.9375em" }}>Full flash erase</span>
        </label>

        <hr style={{ margin: 0, borderColor: "var(--ifm-color-emphasis-200)" }} />

        {/* Connected chip info */}
        {(isConnected || isFlashing) && chipDescription && (
          <p style={{ margin: 0, fontSize: "0.875em", color: "var(--ifm-color-emphasis-700)" }}>
            Connected:{" "}
            <strong style={{ fontFamily: "var(--ifm-font-family-monospace)", fontWeight: 600 }}>
              {chipDescription}
            </strong>
          </p>
        )}

        {/* Incompatible preset admonition */}
        {isPresetIncompatible && (
          <div className="alert alert--warning" role="alert" style={{ margin: 0 }}>
            <strong>Incompatible preset</strong> — the selected preset is
            designed for <strong>{presetChip}</strong>, but the connected
            device is <strong>{chipFamily}</strong>. Choose a compatible
            preset or select <em>No preset</em>.
          </div>
        )}

        {/* Status alerts */}
        {phase === "done" && (
          <div className="alert alert--success" role="alert" style={{ margin: 0 }}>
            Flashing complete — the device is restarting.
          </div>
        )}
        {phase === "error" && errorMsg && (
          <div className="alert alert--danger" role="alert" style={{ margin: 0 }}>
            <strong>Error:</strong> {errorMsg}
          </div>
        )}

        {/* Primary action button(s) */}
        {!isConnected ? (
          /* Before connecting: single full-width connect button */
          <button
            className="button button--primary button--lg button--block"
            onClick={handleConnect}
            disabled={isBusy}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
          >
            <Plug size={18} strokeWidth={2} />
            {phase === "connecting" ? "Connecting…" : "Connect to serial port"}
          </button>
        ) : (
          /* Connected: Flash (grows) + Disconnect (fixed, red) */
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "stretch" }}>
            <button
              className="button button--primary button--lg"
              onClick={handleFlash}
              disabled={!canFlash}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                ...(isPresetIncompatible ? { opacity: 0.4, cursor: "not-allowed" } : {}),
              }}
            >
              <Zap size={18} strokeWidth={2} />
              {isFlashing ? "Flashing…" : "Flash firmware"}
            </button>
            <button
              className="button button--danger button--outline"
              onClick={handleDisconnect}
              disabled={isFlashing}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                whiteSpace: "nowrap",
              }}
            >
              <Unplug size={16} strokeWidth={2} />
              Disconnect
            </button>
          </div>
        )}

        {/* Progress bar */}
        {isFlashing && (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <progress
              value={progress}
              max={100}
              style={{ width: "100%", height: "6px", display: "block" }}
            />
            <span style={{ fontSize: "0.78em", textAlign: "right", color: "var(--ifm-color-emphasis-500)" }}>
              {progress}%
            </span>
          </div>
        )}
      </div>

      {/* Console — permanent, no header */}
      <pre
        ref={logScrollRef}
        style={{
          margin: 0,
          height: "200px",
          overflowY: "auto",
          background: "#0d1117",
          color: "#c9d1d9",
          borderTop: "1px solid #30363d",
          padding: "10px 14px",
          fontSize: "0.78em",
          fontFamily: "var(--ifm-font-family-monospace)",
          lineHeight: 1.65,
          borderRadius: 0,
        }}
      >
        {log.length > 0 ? (
          log.join("\n")
        ) : (
          <span style={{ color: "#484f58" }}>Waiting for connection…</span>
        )}
      </pre>
    </div>
  );
}

export default function FirmwareFlasher(): React.ReactElement {
  const { releases } = usePluginData("firmware-releases-plugin") as {
    releases: ReleaseInfo[];
  };
  const { siteConfig } = useDocusaurusContext();
  const baseUrl = siteConfig.baseUrl;

  if (!releases || releases.length === 0) {
    return (
      <p>
        No firmware releases are available yet. Check back after a tagged
        release is built on GitHub.
      </p>
    );
  }

  return (
    <BrowserOnly fallback={<p>Loading flasher…</p>}>
      {() => <FlasherPanel releases={releases} baseUrl={baseUrl} />}
    </BrowserOnly>
  );
}
