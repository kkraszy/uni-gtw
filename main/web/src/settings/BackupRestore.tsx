import { useRef, useState } from "preact/hooks";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { m } from "../paraglide/messages.js";
import { ParaglideMessage } from "@inlang/paraglide-js-react";

interface Props {
  hostname: string;
  authHeaders: Record<string, string>;
}

type RestoreStatus = "idle" | "saving" | "rebooting" | "error";

export function BackupRestore({ hostname, authHeaders }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [restoreFileContent, setRestoreFileContent] = useState<string | null>(null);
  const [restoreFileName, setRestoreFileName] = useState<string>("");
  const [status, setStatus] = useState<RestoreStatus>("idle");

  const downloadBackup = () => {
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const timeStr = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
    fetch("/api/backup", { headers: authHeaders })
      .then((r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${hostname}-backup-${dateStr}-${timeStr}.json`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => alert(m.backup_restore_failed()));
  };

  const handleRestoreFileChange = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      setRestoreFileName(file.name);
      setRestoreFileContent(reader.result as string);
      setShowRestoreConfirm(true);
    });
    reader.readAsText(file);
    (e.target as HTMLInputElement).value = "";
  };

  const confirmRestore = () => {
    if (!restoreFileContent) return;
    setShowRestoreConfirm(false);
    setStatus("saving");
    fetch("/api/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: restoreFileContent,
    })
      .then((r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        setStatus("rebooting");
      })
      .catch(() => setStatus("error"))
      .finally(() => {
        setRestoreFileContent(null);
        setRestoreFileName("");
      });
  };

  return (
    <>
      <div class="border-t border-zinc-800 pt-4 mt-2 mb-4">
        <p class="text-zinc-500 text-xs font-semibold uppercase tracking-wide mb-2">
          {m.backup_section_title()}
        </p>
        <p class="text-zinc-600 text-xs mb-3">{m.backup_description()}</p>
        <div class="flex gap-2 flex-wrap items-center">
          <Button onClick={downloadBackup} disabled={status === "saving" || status === "rebooting"}>
            {m.backup_export()}
          </Button>
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={status === "saving" || status === "rebooting"}
          >
            {m.backup_import()}
          </Button>
          {status === "rebooting" && (
            <span class="text-amber-400 text-xs">{m.status_rebooting()}</span>
          )}
          {status === "error" && (
            <span class="text-red-400 text-xs">{m.backup_restore_failed()}</span>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          class="hidden"
          onChange={handleRestoreFileChange}
        />
      </div>

      {showRestoreConfirm && (
        <Modal
          title={m.backup_modal_title()}
          okLabel={m.backup_modal_ok()}
          onOk={confirmRestore}
          onCancel={() => {
            setShowRestoreConfirm(false);
            setRestoreFileContent(null);
            setRestoreFileName("");
          }}
        >
          <p class="text-xs text-zinc-500 mb-3 font-mono break-all">{restoreFileName}</p>
          <p class="text-sm text-zinc-300 mb-3">
            <ParaglideMessage
              message={m.backup_modal_body}
              inputs={{}}
              markup={{
                strong: ({ children }) => <strong>{children}</strong>,
              }}
            />
          </p>
          <Alert variant="warning">{m.backup_modal_warning()}</Alert>
        </Modal>
      )}
    </>
  );
}
