import { DataTable, type DataTableFilter } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { type ColumnDef } from '@tanstack/react-table';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'لوحة التحكم', href: '/dashboard' },
    { title: 'الإعدادات', href: '/settings' },
    { title: 'سجل المدراء', href: '/principals' },
];

interface PrincipalEntry {
    id: number;
    school: string;
    year: string;
    name: string;
}

export default function PrincipalsIndex({ principals }: Readonly<{ principals: PrincipalEntry[] }>) {
    const columns: ColumnDef<PrincipalEntry>[] = [
        { accessorKey: 'school', header: 'المدرسة', cell: ({ row }) => <span className="font-medium">{row.original.school}</span> },
        { accessorKey: 'year', header: 'العام الدراسي', cell: ({ row }) => <span className="tnum">{row.original.year}</span> },
        { accessorKey: 'name', header: 'مدير المدرسة' },
    ];

    const years = Array.from(new Set(principals.map((p) => p.year).filter(Boolean)));
    const filters: DataTableFilter<PrincipalEntry>[] = [
        {
            id: 'year',
            label: 'العام الدراسي',
            options: years.map((y) => ({ value: y, label: y })),
            getValue: (p) => p.year,
        },
    ];

    const renderCard = (p: PrincipalEntry) => (
        <Card className="flex h-full flex-col gap-2 p-4">
            <span className="font-semibold">{p.school}</span>
            <div className="text-sm">
                <span className="text-muted-foreground text-xs">مدير المدرسة: </span>
                <span>{p.name}</span>
            </div>
            <span className="text-muted-foreground tnum mt-auto text-xs">{p.year}</span>
        </Card>
    );

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="سجل المدراء" />
            <div className="flex flex-col gap-6 p-4 md:p-6">
                <PageHeader title="سجل مدراء المدارس" description="مدراء المدارس عبر الأعوام الدراسية" backHref="/settings" />
                <DataTable
                    columns={columns}
                    data={principals}
                    searchPlaceholder="ابحث باسم المدرسة أو المدير..."
                    emptyMessage="لا يوجد مدراء مسجّلون بعد — يُسجَّل المدير عند إضافة/تعديل المدرسة أو عند الاستيراد"
                    storageKey="view:principals"
                    filters={filters}
                    renderCard={renderCard}
                />
            </div>
        </AppLayout>
    );
}
