import type { ComponentChildren } from "preact";

export function FieldLabel({ children }: { children: ComponentChildren }) {
  return <label class="block mb-1 text-xs text-zinc-400">{children}</label>;
}
