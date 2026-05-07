import { useEffect, useState } from "preact/hooks";
import { Cpu, ExternalLink, Package, Scale } from "lucide-preact";
import { Logo } from "./Logo";
import { InfoTable } from "./ui/InfoTable";
import type { InfoRow } from "./ui/InfoTable";
import { SectionCard } from "./ui/SectionCard";
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
      <div class="flex items-center gap-4 mb-8">
        <Logo size={64} />
        <div>
          <h1 class="text-2xl font-bold tracking-wide">uni-gtw</h1>
          <p class="text-zinc-400 text-sm mt-0.5">
            ESP32 RF Gateway compatible with Mobilus COSMO blinds
          </p>
        </div>
      </div>

      <SectionCard icon={ExternalLink} title="Links">
        <a
          href="https://github.com/alufers/uni-gtw"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 border border-zinc-800 hover:border-zinc-600 rounded-lg px-4 py-2.5 transition-colors self-start"
        >
          <ExternalLink size={14} class="shrink-0" />
          github.com/alufers/uni-gtw
        </a>
      </SectionCard>

      <SectionCard icon={Package} title="Firmware">
        <InfoTable rows={firmwareRows} />
      </SectionCard>

      <SectionCard icon={Scale} title="License">
        <div class="flex flex-col gap-3 text-sm text-zinc-300">
          <p>
            uni-gtw is licensed under the GNU General Public License, version 3
            (GPLv3).
          </p>
          <p class="text-zinc-400">
            You may use, study, modify, and redistribute it under the terms of
            that license. The software is provided without warranty.
          </p>
          <a
            href="https://github.com/alufers/uni-gtw/blob/master/LICENSE"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 border border-zinc-800 hover:border-zinc-600 rounded-lg px-4 py-2.5 transition-colors self-start"
          >
            <ExternalLink size={14} class="shrink-0" />
            View full GPLv3 license text
          </a>
        </div>
      </SectionCard>

      <SectionCard icon={Cpu} title="Device">
        <InfoTable rows={deviceRows} />
      </SectionCard>
    </div>
  );
}
