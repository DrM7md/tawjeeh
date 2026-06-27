import { DataTable } from '@/components/shared/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StatCard } from '@/components/stat-card';
import { type ImportData } from '@/types';
import { router } from '@inertiajs/react';
import { type ColumnDef } from '@tanstack/react-table';
import { AlertTriangle, Ban, CheckCircle2, Download, FileSpreadsheet, RefreshCw, Upload } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';

type Row = ImportData['preview']['rows'][number];

interface ImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description?: string;
    templateUrl: string;
    previewUrl: string;
    storeUrl: string;
    /** عنوان الصفحة الأساسية للعودة إليه وإلغاء المعاينة. */
    baseUrl: string;
    /** أعمدة عرض المعاينة (عدا الرقم والحالة). */
    columns: { key: string; label: string }[];
    /** بيانات المعاينة القادمة من خصائص الصفحة. */
    data?: ImportData;
    /** هل الاستيراد متاح (العام نشط)؟ */
    disabled?: boolean;
    disabledHint?: string;
    /** نص تنبيه المزامنة (كم عنصرًا سيُعطَّل) — يُمرَّر العدد. الافتراضي مخصّص للمدارس. */
    deactivateHint?: (count: number) => string;
}

const statusBadge: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
    new: { label: 'جديد', variant: 'default' },
    update: { label: 'تحديث', variant: 'secondary' },
    error: { label: 'خطأ', variant: 'destructive' },
};

export function ImportDialog({
    open,
    onOpenChange,
    title,
    description,
    templateUrl,
    previewUrl,
    storeUrl,
    baseUrl,
    columns,
    data,
    disabled = false,
    disabledHint,
    deactivateHint,
}: ImportDialogProps) {
    const [uploading, setUploading] = useState(false);
    const [confirming, setConfirming] = useState(false);

    const onDrop = useCallback(
        (files: File[]) => {
            if (!files.length) return;
            setUploading(true);
            router.post(
                previewUrl,
                { file: files[0] },
                {
                    forceFormData: true,
                    preserveState: true,
                    preserveScroll: true,
                    onFinish: () => setUploading(false),
                    onError: () => toast.error('تعذّر قراءة الملف'),
                },
            );
        },
        [previewUrl],
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/vnd.ms-excel': ['.xls'],
            'text/csv': ['.csv'],
        },
        multiple: false,
        disabled,
    });

    const clearPreview = () => router.get(baseUrl, {}, { preserveScroll: true });

    const close = () => {
        if (data) clearPreview();
        onOpenChange(false);
    };

    const confirmImport = () => {
        if (!data) return;
        setConfirming(true);
        router.post(
            storeUrl,
            { token: data.token, original_name: data.originalName },
            {
                onFinish: () => setConfirming(false),
                onSuccess: () => onOpenChange(false),
            },
        );
    };

    const previewColumns: ColumnDef<Row>[] = [
        { accessorKey: 'row', header: '#', cell: ({ row }) => <span className="tnum">{row.original.row}</span> },
        ...columns.map<ColumnDef<Row>>((c) => ({
            accessorKey: c.key,
            header: c.label,
            cell: ({ row }) => <span>{(row.original[c.key] as string) || '—'}</span>,
        })),
        {
            accessorKey: 'status',
            header: 'الحالة',
            cell: ({ row }) => {
                const b = statusBadge[row.original.status];
                return (
                    <div className="flex items-center gap-2">
                        <Badge variant={b.variant}>{b.label}</Badge>
                        {row.original.status === 'error' && <span className="text-destructive text-xs">{row.original.message}</span>}
                    </div>
                );
            },
        },
    ];

    const preview = data?.preview;

    return (
        <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
            <DialogContent className={preview ? 'sm:max-w-[820px]' : 'sm:max-w-[560px]'}>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    {description && <DialogDescription>{description}</DialogDescription>}
                </DialogHeader>

                {disabled && (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
                        {disabledHint ?? 'الاستيراد متاح فقط في العام الدراسي النشط.'}
                    </div>
                )}

                <div className="flex justify-end">
                    <Button variant="outline" size="sm" asChild>
                        <a href={templateUrl}>
                            <Download className="size-4" /> تنزيل القالب
                        </a>
                    </Button>
                </div>

                {!preview ? (
                    <div
                        {...getRootProps()}
                        className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 text-center transition ${
                            isDragActive ? 'border-primary bg-primary/5' : 'border-border'
                        } ${disabled ? 'pointer-events-none opacity-50' : ''}`}
                    >
                        <input {...getInputProps()} />
                        <div className="bg-primary/10 flex size-14 items-center justify-center rounded-2xl">
                            <Upload className="text-primary size-6" />
                        </div>
                        <div>
                            <p className="font-medium">{uploading ? 'جارٍ القراءة...' : 'اسحب ملف Excel هنا أو انقر للاختيار'}</p>
                            <p className="text-muted-foreground text-xs">xlsx / xls / csv — بحد أقصى 10MB</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className={`grid gap-3 ${preview.summary.deactivate === undefined ? 'sm:grid-cols-3' : 'sm:grid-cols-4'}`}>
                            <StatCard title="جديد" value={preview.summary.new} icon={CheckCircle2} tone="success" />
                            <StatCard title="تحديثات" value={preview.summary.update} icon={RefreshCw} tone="info" />
                            {preview.summary.deactivate !== undefined && (
                                <StatCard title="سيُعطَّل" value={preview.summary.deactivate} icon={Ban} tone="warning" />
                            )}
                            <StatCard title="أخطاء" value={preview.summary.error} icon={AlertTriangle} tone="destructive" />
                        </div>
                        {!!preview.summary.deactivate && (
                            <p className="text-muted-foreground text-xs">
                                {deactivateHint
                                    ? deactivateHint(preview.summary.deactivate)
                                    : `المزامنة: ${preview.summary.deactivate} مدرسة موجودة في النظام وغير مذكورة في الملف ستصبح «غير نشطة» (لن تُحذف).`}
                            </p>
                        )}

                        <div className="max-h-[42vh] overflow-y-auto">
                            <DataTable columns={previewColumns} data={preview.rows} searchable={false} pageSize={8} />
                        </div>

                        <div className="flex items-center justify-between">
                            <p className="text-muted-foreground text-sm">{preview.total} صف</p>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={clearPreview}>
                                    ملف آخر
                                </Button>
                                <Button
                                    onClick={confirmImport}
                                    disabled={confirming || preview.summary.new + preview.summary.update + (preview.summary.deactivate ?? 0) === 0}
                                >
                                    <FileSpreadsheet className="size-4" /> تأكيد الاستيراد
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
