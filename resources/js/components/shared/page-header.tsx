import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import { ArrowRight } from 'lucide-react';

interface PageHeaderProps {
    title: string;
    description?: string;
    actions?: React.ReactNode;
    /** عند تمريره يظهر زر عودة جميل قبل العنوان (في الاتجاه RTL يشير لليمين). */
    backHref?: string;
    className?: string;
}

/** ترويسة صفحة موحّدة: زر عودة (اختياري) + عنوان + وصف + أزرار إجراء. */
export function PageHeader({ title, description, actions, backHref, className }: PageHeaderProps) {
    return (
        <div className={cn('flex flex-wrap items-center justify-between gap-3', className)}>
            <div className="flex items-center gap-3">
                {backHref && (
                    <Button variant="outline" size="icon" asChild className="size-9 shrink-0 rounded-full">
                        <Link href={backHref} aria-label="عودة">
                            <ArrowRight className="size-4" />
                        </Link>
                    </Button>
                )}
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
                    {description && <p className="text-muted-foreground text-sm">{description}</p>}
                </div>
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
    );
}
