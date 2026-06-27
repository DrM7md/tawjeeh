import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'لوحة التحكم', href: '/dashboard' },
    { title: 'استيراد المعلمين', href: '/roster-import' },
];

interface PreviewRow {
    row: number;
    school: string;
    name: string;
    national_id: string;
    annual_eval: string;
    classification: string | null;
    is_coordinator: boolean;
    status: 'new' | 'update' | 'error';
    message: string;
}

interface Preview {
    rows: PreviewRow[];
    summary: {
        teachers_new: number;
        teachers_update: number;
        coordinators: number;
        schools: number;
        classified: number;
        deactivate: number;
        error: number;
    };
    total: number;
}

interface Batch {
    id: number;
    original_filename: string;
    imported_rows: number;
    updated_rows: number;
    failed_rows: number;
    errors_count: number;
    summary: { schools?: number; coordinators?: number; deactivated?: number; classified?: number } | null;
    created_at: string;
    user?: { id: number; name: string } | null;
}

interface Dept {
    id: number;
    name: string;
}

interface BatchErrors {
    batch: { id: number; original_filename: string };
    errors: { row_number: number; message: string; raw_data: Record<string, string> }[];
}

interface PageProps {
    batches: Batch[];
    department: Dept | null;
    departments: Dept[];
    preview?: Preview;
    token?: string;
    originalName?: string;
    selectedDepartmentId?: number;
    batchErrors?: BatchErrors;
}

const statusLabel: Record<string, string> = { new: 'جديد', update: 'تحديث', error: 'خطأ' };

export default function RosterImportIndex({
    batches,
    department,
    departments,
    preview,
    token,
    originalName,
    selectedDepartmentId,
    batchErrors,
}: PageProps) {
    const [importing, setImporting] = useState(false);
    const lockedDeptId = department?.id ?? null;
    const [deptId, setDeptId] = useState<string>(
        selectedDepartmentId ? String(selectedDepartmentId) : lockedDeptId ? String(lockedDeptId) : '',
    );

    const effectiveDept = lockedDeptId ?? (deptId ? Number(deptId) : null);

    const upload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!effectiveDept) {
            toast.error('اختر القسم أولًا');
            e.target.value = '';
            return;
        }
        router.post(
            '/roster-import/preview',
            { file, department_id: effectiveDept },
            {
                forceFormData: true,
                preserveScroll: true,
                preserveState: false,
                onError: (errors) => toast.error(errors.file ?? 'تعذّر قراءة الملف'),
            },
        );
        e.target.value = '';
    };

    const confirmImport = () => {
        if (!token || !effectiveDept) return;
        setImporting(true);
        router.post(
            '/roster-import',
            { token, original_name: originalName, department_id: effectiveDept },
            {
                onSuccess: () => toast.success('اكتمل استيراد الكشف'),
                onError: () => toast.error('تعذّر إتمام الاستيراد'),
                onFinish: () => setImporting(false),
            },
        );
    };

    const validRows = preview ? preview.summary.teachers_new + preview.summary.teachers_update : 0;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="استيراد المعلمين" />
            <div className="flex flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title="استيراد المعلمين"
                    description="كشف يشير لمدارس موجودة فقط — يُشتقّ التصنيف من التقييم السنوي، ويُحدَّد المنسق بـ«نعم»"
                    actions={
                        <Button variant="outline" asChild>
                            <Link href="/coordinators">المنسقون</Link>
                        </Button>
                    }
                />

                <Card className="flex flex-col gap-4 p-5">
                    <div className="flex flex-wrap items-end gap-3">
                        {/* القسم: مقفل لرئيس القسم، اختيار للإدارة العليا */}
                        <div className="space-y-1.5">
                            <Label>القسم</Label>
                            {lockedDeptId ? (
                                <div className="bg-muted/50 flex h-9 items-center rounded-md border border-border/60 px-3 text-sm font-medium">
                                    {department?.name}
                                </div>
                            ) : (
                                <Select value={deptId} onValueChange={setDeptId}>
                                    <SelectTrigger className="min-w-[200px]">
                                        <SelectValue placeholder="اختر القسم" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {departments.map((d) => (
                                            <SelectItem key={d.id} value={String(d.id)}>
                                                {d.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>

                        <Button variant="outline" asChild>
                            <a href="/schools-roster-template">
                                <Download className="size-4" /> تنزيل قالب الكشف
                            </a>
                        </Button>
                        <Label
                            htmlFor="roster-file"
                            data-disabled={!effectiveDept}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 cursor-pointer items-center gap-2 rounded-md px-4 text-sm font-medium data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50"
                        >
                            <Upload className="size-4" /> اختر ملف Excel
                        </Label>
                        <input id="roster-file" type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={upload} />
                    </div>
                    <p className="text-muted-foreground text-sm">
                        صف واحد لكل معلم، واختر المدرسة من القائمة. اكتب «التقييم السنوي» (مثل 92 أو 92%) فيُشتقّ التصنيف
                        تلقائيًا، وضع «نعم» في عمود «منسق؟» لمنسق المادة. المدارس غير الموجودة تظهر كخطأ — استوردها من صفحة المدارس أولًا.
                    </p>
                </Card>

                {preview && (
                    <Card className="flex flex-col gap-4 p-5">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                            <Badge>مدارس: {preview.summary.schools}</Badge>
                            <Badge>معلم جديد: {preview.summary.teachers_new}</Badge>
                            <Badge variant="secondary">تحديث: {preview.summary.teachers_update}</Badge>
                            <Badge variant="outline">مُصنّف: {preview.summary.classified}</Badge>
                            <Badge variant="outline">منسقون: {preview.summary.coordinators}</Badge>
                            <Badge variant="secondary">سيُعطَّل: {preview.summary.deactivate}</Badge>
                            <Badge variant={preview.summary.error > 0 ? 'destructive' : 'secondary'}>أخطاء: {preview.summary.error}</Badge>
                            <span className="text-muted-foreground self-center">الملف: {originalName}</span>
                        </div>

                        <div className="max-h-[28rem] overflow-auto rounded-xl border border-border/60">
                            <table className="w-full text-sm">
                                <thead className="bg-primary/[0.12] text-primary sticky top-0 border-b-2 border-primary/30 font-bold">
                                    <tr>
                                        <th className="p-2 text-right">#</th>
                                        <th className="p-2 text-right">المدرسة</th>
                                        <th className="p-2 text-right">المعلم</th>
                                        <th className="p-2 text-right">الرقم الشخصي</th>
                                        <th className="p-2 text-right">التقييم</th>
                                        <th className="p-2 text-right">التصنيف</th>
                                        <th className="p-2 text-right">منسق</th>
                                        <th className="p-2 text-right">الحالة</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {preview.rows.map((r) => (
                                        <tr key={r.row} className="border-t border-border/40">
                                            <td className="p-2">{r.row}</td>
                                            <td className="p-2">{r.school || '—'}</td>
                                            <td className="p-2">{r.name || '—'}</td>
                                            <td className="p-2" dir="ltr">
                                                {r.national_id || '—'}
                                            </td>
                                            <td className="p-2 tnum">{r.annual_eval || '—'}</td>
                                            <td className="p-2">{r.classification ?? '—'}</td>
                                            <td className="p-2">{r.is_coordinator ? <Badge variant="outline">منسق</Badge> : '—'}</td>
                                            <td className="p-2">
                                                {r.status === 'error' ? (
                                                    <span className="text-destructive">{r.message}</span>
                                                ) : (
                                                    <Badge variant={r.status === 'new' ? 'default' : 'secondary'}>{statusLabel[r.status]}</Badge>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex justify-end gap-2">
                            <Button onClick={confirmImport} disabled={importing || validRows === 0}>
                                تأكيد الاستيراد ({validRows} معلم)
                            </Button>
                        </div>
                    </Card>
                )}

                {batchErrors && (
                    <Card className="flex flex-col gap-3 p-5">
                        <h2 className="text-sm font-semibold">أخطاء الملف: {batchErrors.batch.original_filename}</h2>
                        <div className="max-h-[24rem] overflow-auto rounded-xl border border-border/60">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50 font-medium">
                                    <tr>
                                        <th className="p-2 text-right">الصف</th>
                                        <th className="p-2 text-right">الخطأ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {batchErrors.errors.map((e, i) => (
                                        <tr key={i} className="border-t border-border/40">
                                            <td className="p-2">{e.row_number}</td>
                                            <td className="text-destructive p-2">{e.message}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                )}

                <div>
                    <h2 className="text-muted-foreground mb-3 text-sm font-semibold">آخر عمليات استيراد المعلمين</h2>
                    {batches.length === 0 ? (
                        <p className="text-muted-foreground text-sm">لا توجد عمليات سابقة.</p>
                    ) : (
                        <div className="overflow-auto rounded-xl border border-border/60">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50 font-medium">
                                    <tr>
                                        <th className="p-2 text-right">الملف</th>
                                        <th className="p-2 text-right">المنفّذ</th>
                                        <th className="p-2 text-right">جديد</th>
                                        <th className="p-2 text-right">محدّث</th>
                                        <th className="p-2 text-right">مُصنّف</th>
                                        <th className="p-2 text-right">منسقون</th>
                                        <th className="p-2 text-right">مُعطَّل</th>
                                        <th className="p-2 text-right">فاشل</th>
                                        <th className="p-2 text-right">التاريخ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {batches.map((b) => (
                                        <tr key={b.id} className="border-t border-border/40">
                                            <td className="flex items-center gap-2 p-2">
                                                <FileSpreadsheet className="text-muted-foreground size-4" />
                                                {b.errors_count > 0 ? (
                                                    <Link href={`/roster-import/${b.id}/errors`} className="text-primary hover:underline">
                                                        {b.original_filename}
                                                    </Link>
                                                ) : (
                                                    b.original_filename
                                                )}
                                            </td>
                                            <td className="p-2">{b.user?.name ?? '—'}</td>
                                            <td className="p-2">{b.imported_rows}</td>
                                            <td className="p-2">{b.updated_rows}</td>
                                            <td className="p-2">{b.summary?.classified ?? '—'}</td>
                                            <td className="p-2">{b.summary?.coordinators ?? '—'}</td>
                                            <td className="p-2">{b.summary?.deactivated ?? '—'}</td>
                                            <td className="p-2">
                                                {b.failed_rows > 0 ? <span className="text-destructive">{b.failed_rows}</span> : b.failed_rows}
                                            </td>
                                            <td className="p-2">{b.created_at}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
