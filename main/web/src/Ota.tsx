import { useContext, useEffect, useState } from "preact/hooks";
import { AuthContext } from "./AuthContext";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
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

  const handleApply = () => {
    if (!checkResult?.asset_url) return;
    const headers: Record<string, string> = password ? { "X-Auth": password } : {};
    setApplyError(null);
    setApplying(true);
    setShowModal(true);
    fetch("/api/ota/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ url: checkResult.asset_url }),
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
      })
      .catch((e) => {
        setApplyError(String(e));
        setApplying(false);
      });
  };

  const closeModal = () => {
    setShowModal(false);
    setApplying(false);
  };

  const isDone = otaProgress?.status === "done" || otaProgress?.status === "error";

  return (
    <div class="p-4 flex flex-col gap-4 overflow-y-auto h-full">
      <h2 class="text-sm font-bold text-zinc-200">Firmware Updates</h2>

      {checking && <p class="text-xs text-zinc-400">Checking for updates…</p>}

      {checkError && <p class="text-xs text-red-400">Failed to check for updates: {checkError}</p>}

      {checkResult && !checking && (
        <div class="flex flex-col gap-3">
          <div class="text-xs text-zinc-400 flex flex-col gap-1">
            <span>
              Current version:{" "}
              <span class="text-zinc-200">{checkResult.current_version ?? "unknown"}</span>
            </span>
            {checkResult.latest_version && (
              <span>
                Latest version: <span class="text-zinc-200">{checkResult.latest_version}</span>
              </span>
            )}
          </div>

          {checkResult.update_available ? (
            <div class="flex flex-col gap-3 border border-zinc-700 rounded p-3">
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
        </div>
      )}

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
    </div>
  );
}
