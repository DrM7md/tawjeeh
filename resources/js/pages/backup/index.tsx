import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { type ColumnDef } from '@tanstack/react-table';
import { Database, Download, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'لوحة التحكم', href: '/dashboard' },
    { title: 'النسخ الاحتياطي', href: '/backups' },
];

interface Backup {
    name: string;
    size: number;
    date: string;
}

export default function BackupIndex({ backups }: { backups: Backup[] }) {
    const [running, setRunning] = useState(false);
    const [deleting, setDeleting] = useState<Backup | null>(null);

    const run = () => {
        setRunning(true);
        router.post('/backups/run', {}, { preserveScroll: true, onFinish: () => setRunning(false), onSuccess: () => toast.success('تم إنشاء نسخة احتياطية') });
    };

    const columns: ColumnDef<Backup>[] = [
        { accessorKey: 'name', header: 'الملف', cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
        { accessorKey: 'size', header: 'الحجم (KB)', cell: ({ row }) => <span className="tnum">{row.original.size}</span> },
        { accessorKey: 'date', header: 'التاريخ', cell: ({ row }) => <span className="tnum">{row.original.date}</span> },
        {
            id: 'actions',
            header: '',
            cell: ({ row }) => (
                <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" asChild>
                        <a href={`/backups/${row.original.name}/download`}>
                            <Download className="size-4" />
                        </a>
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleting(row.original)}>
                        <Trash2 className="text-destructive size-4" />
                    </Button>
                </div>
            ),
        },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="النسخ الاحتياطي" />
            <div className="flex flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="النسخ الاحتياطي"
                    description="إنشاء وإدارة النسخ الاحتياطية لقاعدة البيانات"
                    actions={
                        <Button onClick={run} disabled={running}>
                            <Database className="size-4" /> {running ? 'جارٍ...' : 'إنشاء نسخة الآن'}
                        </Button>
                    }
                />
                <DataTable columns={columns} data={backups} searchable={false} emptyMessage="لا توجد نسخ احتياطية بعد" />
            </div>

            <ConfirmDialog
                open={!!deleting}
                onOpenChange={(o) => !o && setDeleting(null)}
                title="حذف النسخة"
                description={`سيتم حذف «${deleting?.name}».`}
                onConfirm={() => deleting && router.delete(`/backups/${deleting.name}`, { preserveScroll: true, onSuccess: () => { setDeleting(null); toast.success('تم الحذف'); } })}
            />
        </AppLayout>
    );
}
