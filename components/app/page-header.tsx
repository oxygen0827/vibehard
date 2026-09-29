import type { LucideIcon } from "lucide-react";
import { ModuleHelp } from "@/components/app/module-help";
import type { ModuleHelpKey } from "@/lib/module-help";

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  description: string;
  helpKey: ModuleHelpKey;
}

export function PageHeader({ icon: Icon, title, description, helpKey }: PageHeaderProps) {
  return (
    <div className="animate-fade-up mb-7 flex min-w-0 items-start gap-3 sm:gap-4">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20 sm:size-12">
        <Icon className="size-5 sm:size-6" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <div className="flex min-w-0 items-start gap-1 sm:items-center sm:gap-2"><h1 className="min-w-0 text-xl font-bold leading-tight tracking-tight text-foreground sm:text-2xl">{title}</h1><ModuleHelp module={helpKey} /></div>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
