import type { ComponentChildren } from "preact";
import type { LucideIcon } from "lucide-preact";

export function SubSection({
  icon: Icon,
  title,
  children,
  divided = true,
}: {
  icon?: LucideIcon;
  title: string;
  children: ComponentChildren;
  divided?: boolean;
}) {
  return (
    <div class={divided ? "border-t border-zinc-800 pt-4 -mt-1" : ""}>
      <h3 class="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">
        {Icon && <Icon size={12} class="shrink-0" />}
        {title}
      </h3>
      {children}
    </div>
  );
}
