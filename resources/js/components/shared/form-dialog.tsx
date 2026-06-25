import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface FormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description?: string;
    children: React.ReactNode;
    onSubmit?: (e: React.FormEvent) => void;
    submitLabel?: string;
    cancelLabel?: string;
    loading?: boolean;
    /** أخفِ أزرار التذييل لو أردت أزرارًا مخصّصة داخل children */
    hideFooter?: boolean;
    className?: string;
}

/**
 * نافذة موحّدة للإضافة/التعديل (نُفضّل Modals لا صفحات منفصلة).
 * تلفّ المحتوى بـ <form> عند تمرير onSubmit.
 */
export function FormDialog({
    open,
    onOpenChange,
    title,
    description,
    children,
    onSubmit,
    submitLabel = 'حفظ',
    cancelLabel = 'إلغاء',
    loading = false,
    hideFooter = false,
    className,
}: FormDialogProps) {
    const body = (
        <>
            <DialogHeader>
                <DialogTitle>{title}</DialogTitle>
                {description && <DialogDescription>{description}</DialogDescription>}
            </DialogHeader>

            <div className="space-y-4 py-2">{children}</div>

            {!hideFooter && (
                <DialogFooter className="gap-2 sm:gap-2">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        {cancelLabel}
                    </Button>
                    <Button type="submit" disabled={loading}>
                        {submitLabel}
                    </Button>
                </DialogFooter>
            )}
        </>
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={cn('sm:max-w-[560px]', className)}>
                {onSubmit ? <form onSubmit={onSubmit}>{body}</form> : body}
            </DialogContent>
        </Dialog>
    );
}

/** قسم داخل النموذج (عنوان + شبكة حقول). */
export function FormSection({ title, children, columns = 2 }: { title?: string; children: React.ReactNode; columns?: 1 | 2 }) {
    return (
        <div className="space-y-3">
            {title && <h3 className="text-sm font-semibold text-muted-foreground">{title}</h3>}
            <div className={cn('grid gap-4', columns === 2 ? 'sm:grid-cols-2' : 'grid-cols-1')}>{children}</div>
        </div>
    );
}
