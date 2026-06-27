import { DataTable, type DataTableFilter } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/stat-card';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDate } from '@/lib/utils';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type DomainUser } from '@/types';
import { Head } from '@inertiajs/react';
import { type ColumnDef } from '@tanstack/react-table';
import { Building2, ClipboardCheck, MapPin } from 'lucide-react';

interface Visit {
    id: number;
    visit_date: string | null;
    visit_type: string | null;
    status: string | null;
    school?: { name: string } | null;
    department?: { name: string } | null;
}

interface Review {
    id: number;
    reviewed_at: string | null;
    status: string | null;
    grade: string | null;
    school?: { name: string } | null;
    department?: { name: string } | null;
    stage?: { name: string } | null;
}

interface AssignedSchool {
    id: number;
    assignment_method: string | null;
    notes: string | null;
    school?: { name: string } | null;
    department?: { name: string } | null;
}

interface PageProps {
    user: DomainUser;
    stats: { visits: number; reviews: number; schools: number };
    visits: Visit[];
    reviews: Review[];
    assignedSchools: AssignedSchool[];
}

const statusBadge = (status: string | null) => {
    if (status === 'final') return <Badge>معتمد</Badge>;
    if (status === 'draft') return <Badge variant="secondary">مسودة</Badge>;
    return <Badge variant="secondary">{status ?? '—'}</Badge>;
};

export default function UserShow({ user, stats, visits, reviews, assignedSchools }: PageProps) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'لوحة التحكم', href: '/dashboard' },
        { title: 'المستخدمون', href: '/users' },
        { title: user.name, href: `/users/${user.id}` },
    ];

    const visitColumns: ColumnDef<Visit>[] = [
        { id: 'school', header: 'المدرسة', cell: ({ row }) => <span className="font-medium">{row.original.school?.name ?? '—'}</span> },
        { id: 'department', header: 'المادة', cell: ({ row }) => row.original.department?.name ?? '—' },
        { id: 'type', header: 'النوع', cell: ({ row }) => row.original.visit_type ?? '—' },
        { accessorKey: 'visit_date', header: 'التاريخ', cell: ({ row }) => <span className="tnum">{formatDate(row.original.visit_date) || '—'}</span> },
        { accessorKey: 'status', header: 'الحالة', cell: ({ row }) => statusBadge(row.original.status) },
    ];

    const reviewColumns: ColumnDef<Review>[] = [
        { id: 'school', header: 'المدرسة', cell: ({ row }) => <span className="font-medium">{row.original.school?.name ?? '—'}</span> },
        { id: 'department', header: 'المادة', cell: ({ row }) => row.original.department?.name ?? '—' },
        { id: 'stage', header: 'المرحلة', cell: ({ row }) => row.original.stage?.name ?? '—' },
        { accessorKey: 'reviewed_at', header: 'التاريخ', cell: ({ row }) => <span className="tnum">{formatDate(row.original.reviewed_at) || '—'}</span> },
        { accessorKey: 'status', header: 'الحالة', cell: ({ row }) => statusBadge(row.original.status) },
    ];

    const schoolColumns: ColumnDef<AssignedSchool>[] = [
        { id: 'school', header: 'المدرسة', cell: ({ row }) => <span className="font-medium">{row.original.school?.name ?? '—'}</span> },
        { id: 'department', header: 'المادة', cell: ({ row }) => row.original.department?.name ?? '—' },
        { id: 'notes', header: 'ملاحظات', cell: ({ row }) => row.original.notes ?? '—' },
    ];

    const statusFilter = {
        id: 'status',
        label: 'الحالة',
        options: [
            { value: 'final', label: 'معتمد' },
            { value: 'draft', label: 'مسودة' },
        ],
    };
    const visitFilters: DataTableFilter<Visit>[] = [{ ...statusFilter, getValue: (v: Visit) => v.status ?? '' }];
    const reviewFilters: DataTableFilter<Review>[] = [{ ...statusFilter, getValue: (r: Review) => r.status ?? '' }];

    const renderVisitCard = (v: Visit) => (
        <Card className="flex h-full flex-col gap-2 p-4">
            <div className="flex items-start justify-between gap-2">
                <span className="font-semibold">{v.school?.name ?? '—'}</span>
                {statusBadge(v.status)}
            </div>
            <dl className="text-muted-foreground grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                <div className="flex flex-col">
                    <dt className="text-xs">المادة</dt>
                    <dd className="text-foreground">{v.department?.name ?? '—'}</dd>
                </div>
                <div className="flex flex-col">
                    <dt className="text-xs">النوع</dt>
                    <dd className="text-foreground">{v.visit_type ?? '—'}</dd>
                </div>
                <div className="flex flex-col">
                    <dt className="text-xs">التاريخ</dt>
                    <dd className="text-foreground tnum">{formatDate(v.visit_date) || '—'}</dd>
                </div>
            </dl>
        </Card>
    );

    const renderReviewCard = (r: Review) => (
        <Card className="flex h-full flex-col gap-2 p-4">
            <div className="flex items-start justify-between gap-2">
                <span className="font-semibold">{r.school?.name ?? '—'}</span>
                {statusBadge(r.status)}
            </div>
            <dl className="text-muted-foreground grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                <div className="flex flex-col">
                    <dt className="text-xs">المادة</dt>
                    <dd className="text-foreground">{r.department?.name ?? '—'}</dd>
                </div>
                <div className="flex flex-col">
                    <dt className="text-xs">المرحلة</dt>
                    <dd className="text-foreground">{r.stage?.name ?? '—'}</dd>
                </div>
                <div className="flex flex-col">
                    <dt className="text-xs">التاريخ</dt>
                    <dd className="text-foreground tnum">{formatDate(r.reviewed_at) || '—'}</dd>
                </div>
            </dl>
        </Card>
    );

    const renderSchoolCard = (s: AssignedSchool) => (
        <Card className="flex h-full flex-col gap-2 p-4">
            <span className="font-semibold">{s.school?.name ?? '—'}</span>
            <div className="text-sm">
                <span className="text-muted-foreground text-xs">المادة: </span>
                <span>{s.department?.name ?? '—'}</span>
            </div>
            {s.notes && <p className="text-muted-foreground text-sm">{s.notes}</p>}
        </Card>
    );

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={user.name} />
            <div className="flex flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title={user.name}
                    description={user.email}
                    backHref="/users"
                    actions={
                        <div className="flex flex-wrap items-center gap-2">
                            {user.is_active ? <Badge>نشط</Badge> : <Badge variant="secondary">معطّل</Badge>}
                            <Badge variant="outline">{user.department?.name ?? 'إدارة التوجيه'}</Badge>
                            {user.roles?.map((r) => (
                                <Badge key={r.id} variant="secondary">
                                    {r.display_name}
                                </Badge>
                            ))}
                        </div>
                    }
                />

                <div className="grid gap-4 sm:grid-cols-3">
                    <StatCard title="الزيارات" value={stats.visits} icon={MapPin} tone="primary" />
                    <StatCard title="التحكيمات" value={stats.reviews} icon={ClipboardCheck} tone="success" />
                    <StatCard title="المدارس المُسندة" value={stats.schools} icon={Building2} tone="warning" />
                </div>

                <Tabs defaultValue="overview">
                    <TabsList>
                        <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
                        <TabsTrigger value="visits">الزيارات ({stats.visits})</TabsTrigger>
                        <TabsTrigger value="reviews">التحكيمات ({stats.reviews})</TabsTrigger>
                        <TabsTrigger value="schools">المدارس المُسندة ({stats.schools})</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="mt-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>معلومات المستخدم</CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-4 sm:grid-cols-2">
                                <Info label="الاسم" value={user.name} />
                                <Info label="البريد الإلكتروني" value={user.email} dir="ltr" />
                                <Info label="رقم الهاتف" value={user.phone || '—'} dir="ltr" />
                                <Info label="القسم" value={user.department?.name ?? 'إدارة التوجيه'} />
                                <Info label="الأدوار" value={user.roles?.map((r) => r.display_name).join('، ') || '—'} />
                                <Info label="آخر دخول" value={user.last_login_at ? formatDate(user.last_login_at) : '—'} />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="visits" className="mt-4">
                        <DataTable
                            columns={visitColumns}
                            data={visits}
                            searchPlaceholder="ابحث في الزيارات..."
                            emptyMessage="لا توجد زيارات"
                            storageKey="view:user-visits"
                            filters={visitFilters}
                            renderCard={renderVisitCard}
                        />
                    </TabsContent>

                    <TabsContent value="reviews" className="mt-4">
                        <DataTable
                            columns={reviewColumns}
                            data={reviews}
                            searchPlaceholder="ابحث في التحكيمات..."
                            emptyMessage="لا توجد تحكيمات"
                            storageKey="view:user-reviews"
                            filters={reviewFilters}
                            renderCard={renderReviewCard}
                        />
                    </TabsContent>

                    <TabsContent value="schools" className="mt-4">
                        <DataTable
                            columns={schoolColumns}
                            data={assignedSchools}
                            searchPlaceholder="ابحث في المدارس..."
                            emptyMessage="لا توجد مدارس مُسندة"
                            storageKey="view:user-schools"
                            renderCard={renderSchoolCard}
                        />
                    </TabsContent>
                </Tabs>
            </div>
        </AppLayout>
    );
}

function Info({ label, value, dir }: { label: string; value: string; dir?: 'ltr' | 'rtl' }) {
    return (
        <div className="space-y-1">
            <p className="text-muted-foreground text-xs">{label}</p>
            <p className="text-sm font-medium" dir={dir}>
                {value}
            </p>
        </div>
    );
}
