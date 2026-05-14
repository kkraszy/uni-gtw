import { useState } from "preact/hooks";
import { Modal } from "./ui/Modal";
import { InfoResponse } from "./wsTypes";
import { m } from "./paraglide/messages.js";

interface PasswordModalProps {
  onSuccess: (password: string) => void;
}

export function PasswordModal({ onSuccess }: PasswordModalProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const handleSubmit = async () => {
    if (!value) return;
    setChecking(true);
    setError(null);
    try {
      const res = await fetch("/api/info", {
        headers: { "X-Auth": value },
      });
      const info: InfoResponse = await res.json();
      if (info.web_password_valid === true) {
        onSuccess(value);
      } else {
        setError(m.auth_wrong_password());
      }
    } catch {
      setError(m.auth_network_error());
    } finally {
      setChecking(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
  };

  return (
    <Modal
      title={m.auth_title()}
      onOk={handleSubmit}
      onCancel={() => {}}
      okLabel={checking ? m.auth_checking() : m.auth_unlock()}
      okDisabled={checking || !value}
    >
      <p class="text-sm text-zinc-400 mb-3">{m.auth_hint()}</p>
      <input
        type="password"
        class="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-blue-500"
        placeholder={m.auth_password_placeholder()}
        value={value}
        onInput={(e) => setValue((e.target as HTMLInputElement).value)}
        onKeyDown={handleKeyDown}
        autoFocus
      />
      {error && <p class="mt-2 text-sm text-red-400">{error}</p>}
    </Modal>
  );
}
