import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'لوحة التحكم', href: '/dashboard' },
    { title: 'سجل النشاط', href: '/audit' },
];

interface Log {
    id: number;
    user: string;
    action: string;
    type: string;
    auditable_id: number | null;
    ip: string | null;
    created_at: string | null;
}
interface Paginated<T> {
    data: T[];
    links: { url: string | null; label: string; active: boolean }[];
}

const actionLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
    created: { label: 'إنشاء', variant: 'default' },
    updated: { label: 'تعديل', variant: 'secondary' },
    deleted: { label: 'حذف', variant: 'destructive' },
    login: { label: 'دخول', variant: 'secondary' },
};

export default function AuditIndex({ logs, filterAction }: { logs: Paginated<Log>; filterAction?: string }) {
    const filter = (action?: string) => router.get('/audit', action ? { action } : {}, { preserveScroll: true });

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="سجل النشاط" />
            <div className="flex flex-col gap-6 p-4 md:p-6">
                <PageHeader title="سجل النشاط" description="توثيق كامل لعمليات النظام الحسّاسة" />

                <div className="flex flex-wrap gap-2">
                    {['', 'created', 'updated', 'deleted', 'login'].map((a) => (
                        <Button key={a || 'all'} variant={filterAction === a || (!filterAction && !a) ? 'default' : 'outline'} size="sm" onClick={() => filter(a || undefined)}>
                            {a ? actionLabels[a].label : 'الكل'}
                        </Button>
                    ))}
                </div>

                <div className="bg-card overflow-hidden rounded-2xl border border-border/60">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead>المستخدم</TableHead>
                                <TableHead>العملية</TableHead>
                                <TableHead>النوع</TableHead>
                                <TableHead>المعرّف</TableHead>
                                <TableHead>IP</TableHead>
                                <TableHead>التاريخ</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {logs.data.length ? (
                                logs.data.map((log) => (
                                    <TableRow key={log.id}>
                                        <TableCell className="font-medium">{log.user}</TableCell>
                                        <TableCell>
                                            <Badge variant={actionLabels[log.action]?.variant ?? 'secondary'}>{actionLabels[log.action]?.label ?? log.action}</Badge>
                                        </TableCell>
                                        <TableCell>{log.type || '—'}</TableCell>
                                        <TableCell className="tnum">{log.auditable_id ?? '—'}</TableCell>
                                        <TableCell className="tnum text-xs">{log.ip ?? '—'}</TableCell>
                                        <TableCell className="tnum text-xs">{log.created_at ?? '—'}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-muted-foreground h-24 text-center">
                                        لا توجد سجلات
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* ترقيم الصفحات */}
                <div className="flex flex-wrap justify-center gap-1">
                    {logs.links.map((link, i) => (
                        <Button
                            key={i}
                            variant={link.active ? 'default' : 'outline'}
                            size="sm"
                            disabled={!link.url}
                            asChild={!!link.url}
                        >
                            {link.url ? <Link href={link.url} dangerouslySetInnerHTML={{ __html: link.label }} preserveScroll /> : <span dangerouslySetInnerHTML={{ __html: link.label }} />}
                        </Button>
                    ))}
                </div>
            </div>
        </AppLayout>
    );
}
