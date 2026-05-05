export interface InfoRow {
  label: string;
  value: string | undefined;
  mono?: boolean;
}

export function InfoTable({ rows }: { rows: InfoRow[] }) {
  return (
    <table class="w-full text-sm border-collapse">
      <tbody>
        {rows.map(({ label, value, mono }) => (
          <tr key={label} class="border-b border-zinc-800 last:border-0">
            <td class="py-2 pr-4 text-zinc-400 whitespace-nowrap w-1/3">{label}</td>
            <td class={`py-2 text-zinc-100 break-all ${mono ? "font-mono text-xs" : ""}`}>
              {value ?? <span class="text-zinc-600">—</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
