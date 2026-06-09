interface InfoTableRow {
  term: string
  description: string
}

interface InfoTableProps {
  rows: InfoTableRow[]
}

export function InfoTable({ rows }: InfoTableProps) {
  return (
    <div className="border-border overflow-hidden rounded border">
      <table className="w-full text-sm">
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={index}
              className="border-border odd:bg-muted/40 even:bg-card border-b last:border-0"
            >
              <td className="text-foreground w-40 px-4 py-3 align-top font-medium whitespace-nowrap">
                {row.term}
              </td>
              <td className="text-muted-foreground px-4 py-3 leading-relaxed">{row.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
