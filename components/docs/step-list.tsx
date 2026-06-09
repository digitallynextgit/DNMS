interface StepListProps {
  steps: string[]
}

export function StepList({ steps }: StepListProps) {
  return (
    <ol className="space-y-3">
      {steps.map((step, index) => (
        <li key={index} className="flex items-start gap-3">
          <span className="bg-foreground text-background mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold">
            {index + 1}
          </span>
          <span className="text-foreground text-sm leading-relaxed">{step}</span>
        </li>
      ))}
    </ol>
  )
}
