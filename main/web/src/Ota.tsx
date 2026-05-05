import { useContext, useEffect, useState } from "preact/hooks";
import { Download } from "lucide-preact";
import { AuthContext } from "./AuthContext";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import { Collapsible } from "./ui/Collapsible";
import { PageLoader } from "./ui/PageLoader";
import { SectionCard } from "./ui/SectionCard";
import { OtaProgressPayload } from "./wsTypes";

interface OtaCheckResponse {
  update_available: boolean;
  current_version: string | null;
  latest_version: string | null;
  html_url: string | null;
  asset_url: string | null;
}

interface OtaProps {
  otaProgress: OtaProgressPayload | null;
}

function statusLabel(status: OtaProgressPayload["status"]): string {
  switch (status) {
    case "starting":
      return "Preparing update…";
    case "downloading":
      return "Downloading firmware…";
    case "done":
      return "Update complete — device is rebooting.";
    case "error":
      return "Update failed.";
  }
}

export function Ota({ otaProgress }: OtaProps) {
  const { password } = useContext(AuthContext);

  const [checkResult, setCheckResult] = useState<OtaCheckResponse | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [manualUrl, setManualUrl] = useState("");

  useEffect(() => {
    const headers: Record<string, string> = password ? { "X-Auth": password } : {};
    setChecking(true);
    setCheckError(null);
    fetch("/api/ota/check", { headers })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<OtaCheckResponse>;
      })
      .then((data) => setCheckResult(data))
      .catch((e) => setCheckError(String(e)))
      .finally(() => setChecking(false));
  }, [password]);

  const applyUrl = (url: string) => {
    const headers: Record<string, string> = password ? { "X-Auth": password } : {};
    setApplyError(null);
    setApplying(true);
    setShowModal(true);
    fetch("/api/ota/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ url }),
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
      })
      .catch((e) => {
        setApplyError(String(e));
        setApplying(false);
      });
  };

  const handleApply = () => checkResult?.asset_url && applyUrl(checkResult.asset_url);
  const handleApplyManual = () => manualUrl.trim() && applyUrl(manualUrl.trim());

  const closeModal = () => {
    setShowModal(false);
    setApplying(false);
  };

  const isDone = otaProgress?.status === "done" || otaProgress?.status === "error";

  if (checking) {
    return <PageLoader message="Checking for updates…" />;
  }

  if (checkError) {
    return <PageLoader message={`Failed to check for updates: ${checkError}`} error />;
  }

  return (
    <>
      <div class="p-4 overflow-y-auto h-full">
        <div class="max-w-lg mx-auto">
          <SectionCard icon={Download} title="Firmware Updates">
            <div class="text-xs text-zinc-400 flex flex-col gap-1">
              <span>
                Current version:{" "}
                <span class="text-zinc-200">{checkResult?.current_version ?? "unknown"}</span>
              </span>
              {checkResult?.latest_version && (
                <span>
                  Latest version: <span class="text-zinc-200">{checkResult.latest_version}</span>
                </span>
              )}
            </div>

            {checkResult?.update_available ? (
              <div class="flex flex-col gap-3">
                <p class="text-xs text-zinc-300">
                  A new firmware version is available:{" "}
                  <span class="text-blue-400 font-bold">{checkResult.latest_version}</span>
                </p>
                {checkResult.html_url && (
                  <a
                    href={checkResult.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-xs text-blue-400 underline"
                  >
                    View release notes on GitHub
                  </a>
                )}
                <Button
                  variant="primary"
                  onClick={handleApply}
                  disabled={applying}
                  class="self-start"
                >
                  Apply Update
                </Button>
              </div>
            ) : (
              <p class="text-xs text-zinc-400">Firmware is up to date.</p>
            )}

            <div class="border-t border-zinc-800 pt-4 -mt-1">
              <Collapsible label="Advanced">
                <div class="flex flex-col gap-3 mt-2">
                  <div>
                    <label class="block mb-1 text-xs text-zinc-400">Firmware URL</label>
                    <input
                      type="url"
                      value={manualUrl}
                      placeholder="https://…/firmware.bin"
                      onInput={(e) => setManualUrl((e.target as HTMLInputElement).value)}
                      class="w-full bg-zinc-800 text-zinc-100 border border-zinc-600 rounded px-2 py-1 text-xs font-mono"
                    />
                    <p class="text-zinc-600 text-xs mt-1">
                      Override automatic version detection and flash a specific binary.
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    onClick={handleApplyManual}
                    disabled={applying || !manualUrl.trim()}
                    class="self-start"
                  >
                    Apply URL
                  </Button>
                </div>
              </Collapsible>
            </div>
          </SectionCard>
        </div>
      </div>

      {showModal && (
        <Modal
          title="Applying OTA Update"
          onCancel={isDone ? closeModal : () => {}}
          onOk={isDone ? closeModal : undefined}
          okLabel="Close"
        >
          <div class="flex flex-col gap-3">
            {applyError ? (
              <p class="text-xs text-red-400">Failed to start update: {applyError}</p>
            ) : otaProgress ? (
              <>
                <p class="text-xs text-zinc-300">{statusLabel(otaProgress.status)}</p>
                {otaProgress.progress !== null && (
                  <div class="w-full bg-zinc-800 rounded h-2">
                    <div
                      class="bg-blue-500 h-2 rounded transition-all"
                      style={{ width: `${otaProgress.progress}%` }}
                    />
                  </div>
                )}
                {otaProgress.progress !== null && (
                  <p class="text-xs text-zinc-400 text-right">{otaProgress.progress}%</p>
                )}
                {otaProgress.status === "error" && otaProgress.error && (
                  <p class="text-xs text-red-400">{otaProgress.error}</p>
                )}
              </>
            ) : (
              <p class="text-xs text-zinc-400">Starting update…</p>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
