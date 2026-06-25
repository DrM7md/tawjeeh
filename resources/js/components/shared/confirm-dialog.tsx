import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

interface ConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title?: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
    loading?: boolean;
    onConfirm: () => void;
}

/** نافذة تأكيد موحّدة للإجراءات الخطرة (حذف/اعتماد...). */
export function ConfirmDialog({
    open,
    onOpenChange,
    title = 'تأكيد الإجراء',
    description = 'هل أنت متأكد؟ لا يمكن التراجع عن هذا الإجراء.',
    confirmLabel = 'تأكيد',
    cancelLabel = 'إلغاء',
    destructive = true,
    loading = false,
    onConfirm,
}: ConfirmDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[420px]">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2 sm:gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        {cancelLabel}
                    </Button>
                    <Button variant={destructive ? 'destructive' : 'default'} onClick={onConfirm} disabled={loading}>
                        {confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
