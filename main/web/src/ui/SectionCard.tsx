import type { ComponentChildren } from "preact";
import type { LucideIcon } from "lucide-preact";

export function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon?: LucideIcon;
  title: string;
  children: ComponentChildren;
}) {
  return (
    <div class="bg-zinc-900 border border-zinc-800 rounded-lg mb-4 overflow-hidden">
      <div class="flex items-center gap-2.5 px-4 py-3 border-b border-zinc-800">
        {Icon && <Icon size={15} class="text-zinc-400 shrink-0" />}
        <span class="text-sm font-semibold text-zinc-200">{title}</span>
      </div>
      <div class="p-4 flex flex-col gap-5">{children}</div>
    </div>
  );
}
