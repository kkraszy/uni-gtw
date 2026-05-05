import { useEffect, useState } from "preact/hooks";
import { ExternalLink } from "lucide-preact";
import { Logo } from "./Logo";
import { InfoTable, InfoRow } from "./InfoTable";
import { InfoResponse } from "./wsTypes";

export function About() {
  const [info, setInfo] = useState<InfoResponse | null>(null);

  useEffect(() => {
    fetch("/api/info")
      .then((r) => r.json() as Promise<InfoResponse>)
      .then(setInfo)
      .catch(() => {});
  }, []);

  const buildDate =
    info?.app_build_date && info?.app_build_time
      ? `${info.app_build_date} ${info.app_build_time}`
      : info?.app_build_date;

  const firmwareRows: InfoRow[] = [
    { label: "Project", value: info?.app_project_name },
    { label: "Version", value: info?.app_version },
    { label: "Build date", value: buildDate },
    { label: "IDF version", value: info?.app_idf_ver, mono: true },
    { label: "ELF SHA-256", value: info?.app_elf_sha256, mono: true },
  ];

  const deviceRows: InfoRow[] = [
    { label: "Hostname", value: info?.hostname },
    { label: "Chip", value: info?.chip, mono: true },
  ];

  return (
    <div class="p-4 md:p-6 max-w-xl mx-auto">
      {/* Logo + title */}
      <div class="flex items-center gap-4 mb-8">
        <Logo size={64} />
        <div>
          <h1 class="text-2xl font-bold tracking-wide">uni-gtw</h1>
          <p class="text-zinc-400 text-sm mt-0.5">ESP32 RF Gateway for Cosmo blinds</p>
        </div>
      </div>

      {/* Firmware info */}
      <section class="mb-6">
        <h2 class="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">Firmware</h2>
        <div class="border border-zinc-800 rounded-lg px-4">
          <InfoTable rows={firmwareRows} />
        </div>
      </section>

      {/* Device info */}
      <section class="mb-6">
        <h2 class="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">Device</h2>
        <div class="border border-zinc-800 rounded-lg px-4">
          <InfoTable rows={deviceRows} />
        </div>
      </section>

      {/* Links */}
      <section>
        <h2 class="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">Links</h2>
        <a
          href="https://github.com/alufers/uni-gtw"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 border border-zinc-800 hover:border-zinc-600 rounded-lg px-4 py-2.5 transition-colors"
        >
          <ExternalLink size={14} class="shrink-0" />
          github.com/alufers/uni-gtw
        </a>
      </section>
    </div>
  );
}
