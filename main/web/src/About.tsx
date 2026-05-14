import { useEffect, useState } from "preact/hooks";
import { Cpu, ExternalLink, Package, Scale } from "lucide-preact";
import { Logo } from "./Logo";
import { InfoTable } from "./ui/InfoTable";
import type { InfoRow } from "./ui/InfoTable";
import { SectionCard } from "./ui/SectionCard";
import { InfoResponse } from "./wsTypes";
import { m } from "./paraglide/messages.js";

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
    { label: m.about_row_project(), value: info?.app_project_name },
    { label: m.about_row_version(), value: info?.app_version },
    { label: m.about_row_build_date(), value: buildDate },
    { label: m.about_row_idf_ver(), value: info?.app_idf_ver, mono: true },
    { label: m.about_row_elf_sha(), value: info?.app_elf_sha256, mono: true },
  ];

  const deviceRows: InfoRow[] = [
    { label: m.label_hostname(), value: info?.hostname },
    { label: m.about_row_chip(), value: info?.chip, mono: true },
  ];

  return (
    <div class="p-4 md:p-6 max-w-xl mx-auto">
      <div class="flex items-center gap-4 mb-8">
        <Logo size={64} />
        <div>
          <h1 class="text-2xl font-bold tracking-wide">uni-gtw</h1>
          <p class="text-zinc-400 text-sm mt-0.5">{m.about_description()}</p>
        </div>
      </div>

      <SectionCard icon={ExternalLink} title={m.about_links_section()}>
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

      <SectionCard icon={Package} title={m.about_firmware_section()}>
        <InfoTable rows={firmwareRows} />
      </SectionCard>

      <SectionCard icon={Scale} title={m.about_license_section()}>
        <div class="flex flex-col gap-3 text-sm text-zinc-300">
          <p>{m.about_license_1()}</p>
          <p class="text-zinc-400">{m.about_license_2()}</p>
          <a
            href="https://github.com/alufers/uni-gtw/blob/master/LICENSE"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 border border-zinc-800 hover:border-zinc-600 rounded-lg px-4 py-2.5 transition-colors self-start"
          >
            <ExternalLink size={14} class="shrink-0" />
            {m.about_view_license()}
          </a>
        </div>
      </SectionCard>

      <SectionCard icon={Cpu} title={m.about_device_section()}>
        <InfoTable rows={deviceRows} />
      </SectionCard>
    </div>
  );
}
