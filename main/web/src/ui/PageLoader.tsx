export function PageLoader({ message, error = false }: { message: string; error?: boolean }) {
  return (
    <div class="h-full flex items-center justify-center">
      <span class={`text-xs ${error ? "text-red-400" : "text-zinc-500"}`}>{message}</span>
    </div>
  );
}
