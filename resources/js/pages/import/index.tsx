import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/stat-card';
import { DataTable } from '@/components/shared/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { type ColumnDef } from '@tanstack/react-table';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, RefreshCw, Upload } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'لوحة التحكم', href: '/dashboard' },
    { title: 'استيراد المدارس', href: '/import' },
];

interface Batch {
    id: number;
    original_filename: string;
    status: string;
    total_rows: number;
    imported_rows: number;
    updated_rows: number;
    failed_rows: number;
    errors_count: number;
    user?: { id: number; name: string } | null;
    created_at: string;
}
interface PreviewRow {
    row: number;
    school: string;
    department: string;
    teacher: string;
    coordinator: string;
    classification: string;
    sections: string;
    status: 'new' | 'update' | 'error';
    message: string;
}
interface PageProps {
    batches: Batch[];
    templateHeaders: string[];
    preview?: { rows: PreviewRow[]; summary: { new: number; update: number; error: number }; total: number };
    token?: string;
    originalName?: string;
    batchErrors?: { batch: { id: number; original_filename: string }; errors: { row_number: number; message: string; raw_data: Record<string, string> }[] };
}

const statusBadge: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
    new: { label: 'جديد', variant: 'default' },
    update: { label: 'تحديث', variant: 'secondary' },
    error: { label: 'خطأ', variant: 'destructive' },
};

export default function ImportIndex({ batches, preview, token, originalName, batchErrors }: PageProps) {
    const [uploading, setUploading] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [errorsOpen, setErrorsOpen] = useState(!!batchErrors);

    const onDrop = useCallback((files: File[]) => {
        if (!files.length) return;
        setUploading(true);
        router.post('/import/preview', { file: files[0] }, {
            forceFormData: true,
            preserveScroll: true,
            onFinish: () => setUploading(false),
            onError: () => toast.error('تعذّر قراءة الملف'),
        });
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/vnd.ms-excel': ['.xls'],
            'text/csv': ['.csv'],
        },
        multiple: false,
    });

    const confirmImport = () => {
        if (!token) return;
        setConfirming(true);
        router.post('/import', { token, original_name: originalName }, {
            onFinish: () => setConfirming(false),
            onSuccess: () => toast.success('تم تنفيذ الاستيراد'),
        });
    };

    const cancelPreview = () => router.get('/import', {}, { preserveScroll: true });

    const previewColumns: ColumnDef<PreviewRow>[] = [
        { accessorKey: 'row', header: '#', cell: ({ row }) => <span className="tnum">{row.original.row}</span> },
        { accessorKey: 'school', header: 'المدرسة' },
        { accessorKey: 'department', header: 'المادة' },
        { accessorKey: 'teacher', header: 'المعلم' },
        { accessorKey: 'coordinator', header: 'المنسق', cell: ({ row }) => row.original.coordinator || '—' },
        { accessorKey: 'classification', header: 'التصنيف', cell: ({ row }) => row.original.classification || '—' },
        { accessorKey: 'sections', header: 'الشعب', cell: ({ row }) => <span className="tnum">{row.original.sections || '—'}</span> },
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

    const batchColumns: ColumnDef<Batch>[] = [
        { accessorKey: 'original_filename', header: 'الملف', cell: ({ row }) => <span className="font-medium">{row.original.original_filename}</span> },
        { id: 'user', header: 'بواسطة', cell: ({ row }) => row.original.user?.name ?? '—' },
        { accessorKey: 'total_rows', header: 'الصفوف', cell: ({ row }) => <span className="tnum">{row.original.total_rows}</span> },
        { accessorKey: 'imported_rows', header: 'جديد', cell: ({ row }) => <span className="tnum text-success">{row.original.imported_rows}</span> },
        { accessorKey: 'updated_rows', header: 'محدّث', cell: ({ row }) => <span className="tnum">{row.original.updated_rows}</span> },
        {
            accessorKey: 'failed_rows',
            header: 'فاشل',
            cell: ({ row }) =>
                row.original.failed_rows > 0 ? (
                    <button className="text-destructive tnum underline" onClick={() => router.get(`/import/${row.original.id}/errors`, {}, { preserveScroll: true })}>
                        {row.original.failed_rows}
                    </button>
                ) : (
                    <span className="tnum">0</span>
                ),
        },
        {
            accessorKey: 'status',
            header: 'الحالة',
            cell: ({ row }) => (row.original.status === 'completed' ? <Badge>مكتمل</Badge> : <Badge variant="secondary">{row.original.status}</Badge>),
        },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="استيراد المدارس" />
            <div className="flex flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="استيراد بيانات المدارس"
                    description="ارفع ملف Excel (المدرسة، المرحلة، المادة، المنسق، المعلم، التصنيف، عدد الشعب)"
                    actions={
                        <Button variant="outline" asChild>
                            <a href="/import/template">
                                <Download className="size-4" /> تنزيل القالب
                            </a>
                        </Button>
                    }
                />

                {!preview ? (
                    <div
                        {...getRootProps()}
                        className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-12 text-center transition ${
                            isDragActive ? 'border-primary bg-primary/5' : 'border-border'
                        }`}
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
                        <div className="grid gap-4 sm:grid-cols-3">
                            <StatCard title="سجلات جديدة" value={preview.summary.new} icon={CheckCircle2} tone="success" />
                            <StatCard title="تحديثات" value={preview.summary.update} icon={RefreshCw} tone="info" />
                            <StatCard title="أخطاء" value={preview.summary.error} icon={AlertTriangle} tone="destructive" />
                        </div>

                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold">معاينة ({preview.total} صف)</h2>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={cancelPreview}>إلغاء</Button>
                                <Button onClick={confirmImport} disabled={confirming || preview.summary.new + preview.summary.update === 0}>
                                    <FileSpreadsheet className="size-4" /> تأكيد الاستيراد
                                </Button>
                            </div>
                        </div>

                        <DataTable columns={previewColumns} data={preview.rows} searchPlaceholder="ابحث في المعاينة..." pageSize={15} />
                    </div>
                )}

                {/* سجل عمليات الاستيراد */}
                <div className="space-y-3">
                    <h2 className="text-lg font-semibold">سجل عمليات الاستيراد</h2>
                    <DataTable columns={batchColumns} data={batches} searchable={false} emptyMessage="لا توجد عمليات استيراد بعد" />
                </div>
            </div>

            {/* أخطاء دفعة */}
            <Dialog open={errorsOpen} onOpenChange={(o) => { setErrorsOpen(o); if (!o) router.get('/import', {}, { preserveScroll: true }); }}>
                <DialogContent className="sm:max-w-[640px]">
                    <DialogHeader>
                        <DialogTitle>أخطاء الاستيراد</DialogTitle>
                        <DialogDescription>{batchErrors?.batch.original_filename}</DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[55vh] space-y-2 overflow-y-auto">
                        {batchErrors?.errors.map((e, i) => (
                            <div key={i} className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                                <span className="tnum font-semibold">صف {e.row_number}:</span> {e.message}
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
