import { cn } from '@/lib/utils';

interface PageHeaderProps {
    title: string;
    description?: string;
    actions?: React.ReactNode;
    className?: string;
}

/** ترويسة صفحة موحّدة: عنوان + وصف + أزرار إجراء. */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
    return (
        <div className={cn('flex flex-wrap items-center justify-between gap-3', className)}>
            <div className="space-y-1">
                <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
                {description && <p className="text-muted-foreground text-sm">{description}</p>}
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
    );
}
