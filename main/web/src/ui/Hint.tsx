import type { ComponentChildren } from "preact";

export function Hint({ children }: { children: ComponentChildren }) {
  return <p class="text-zinc-600 text-xs mt-1">{children}</p>;
}
