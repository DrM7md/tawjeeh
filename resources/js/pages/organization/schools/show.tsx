import { ImportDialog } from '@/components/shared/import-dialog';
import { FormDialog } from '@/components/shared/form-dialog';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem, type Grade, type ImportData, type School, type Teacher } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { BookOpen, Crown, Download, GraduationCap, Search, Upload, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

/** مجموعة معلمي قسم/مادة واحدة في صفحة المدرسة. */
interface DepartmentGroup {
    id: number;
    name: string;
    canImport: boolean;
    teachers: Teacher[];
}

interface PageProps {
    school: School;
    departments: DepartmentGroup[];
    grades: Grade[];
    isEditable: boolean;
    teacherImport?: ImportData;
}

const genderLabels: Record<string, string> = { boys: 'بنين', girls: 'بنات', mixed: 'مشترك', male: 'ذكر', female: 'أنثى' };

export default function SchoolShow({ school, departments, grades, isEditable, teacherImport }: Readonly<PageProps>) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'لوحة التحكم', href: '/dashboard' },
        { title: 'المدارس', href: '/schools' },
        { title: school.name, href: `/schools/${school.id}` },
    ];

    const [importFor, setImportFor] = useState<number | null>(teacherImport?.department_id ?? null);
    const [gradesFor, setGradesFor] = useState<Teacher | null>(null);
    const [query, setQuery] = useState('');

    // فلترة فورية: تُطابق الاسم/الرقم الشخصي/الوظيفي/التخصص/المسمى عبر كل المواد.
    const shownDepartments = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return departments;
        const match = (t: Teacher) =>
            [t.name, t.national_id, t.employee_no, t.specialization, t.job_title].some((v) =>
                v?.toLowerCase().includes(q),
            );
        return departments
            .map((d) => ({ ...d, teachers: d.teachers.filter(match) }))
            .filter((d) => d.teachers.length > 0);
    }, [departments, query]);

    useEffect(() => {
        if (teacherImport?.department_id != null) setImportFor(teacherImport.department_id);
    }, [teacherImport]);

    const importDept = useMemo(() => departments.find((d) => d.id === importFor) ?? null, [departments, importFor]);

    // الصفوف مجموعة حسب المرحلة (لمحرّر صفوف المعلم)
    const gradesByStage = useMemo(() => {
        const map = new Map<string, Grade[]>();
        for (const g of grades) {
            const key = g.stage?.name ?? 'أخرى';
            (map.get(key) ?? map.set(key, []).get(key)!).push(g);
        }
        return Array.from(map.entries());
    }, [grades]);

    const infoItems = [
        { label: 'المرحلة', value: school.stage?.name ?? '—' },
        { label: 'النوع', value: school.gender ? genderLabels[school.gender] : '—' },
        { label: 'المنطقة', value: school.zone || '—' },
        { label: 'إيميل المدرسة', value: school.email || '—' },
        { label: 'مدير المدرسة (العام الحالي)', value: school.principal?.name ?? '—' },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={school.name} />
            <div className="flex flex-col gap-6 p-4 md:p-6">
                <PageHeader title={school.name} description="بيانات المدرسة ومعلمو الأقسام" backHref="/schools" />

                {/* معلومات المدرسة */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">معلومات المدرسة</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                            {infoItems.map((it) => (
                                <div key={it.label} className="space-y-1">
                                    <dt className="text-muted-foreground text-xs">{it.label}</dt>
                                    <dd className="text-sm font-medium">{it.value}</dd>
                                </div>
                            ))}
                        </dl>
                    </CardContent>
                </Card>

                {/* بحث فوري عبر كل المواد */}
                <div className="relative max-w-md">
                    <Search className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2" />
                    <Input
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="ابحث عن معلم (الاسم، الرقم الشخصي/الوظيفي، التخصص)..."
                        className="pr-9"
                    />
                </div>

                {/* بطاقة لكل مادة/قسم مع معلميها */}
                {departments.length === 0 && (
                    <Card>
                        <CardContent className="text-muted-foreground py-10 text-center text-sm">لا توجد أقسام لعرضها.</CardContent>
                    </Card>
                )}
                {departments.length > 0 && shownDepartments.length === 0 && (
                    <Card>
                        <CardContent className="text-muted-foreground py-10 text-center text-sm">
                            لا توجد نتائج مطابقة لـ «{query}».
                        </CardContent>
                    </Card>
                )}
                {shownDepartments.map((dept) => (
                    <DepartmentCard
                        key={dept.id}
                        dept={dept}
                        schoolId={school.id}
                        onImport={() => setImportFor(dept.id)}
                        onGrades={setGradesFor}
                    />
                ))}
            </div>

            {importDept && (
                <ImportDialog
                    open={importFor !== null}
                    onOpenChange={(o) => setImportFor(o ? importFor : null)}
                    title={`استيراد معلمي ${importDept.name}`}
                    description="ارفع ملف Excel وفق قالب القسم — التمييز يتم بالرقم الشخصي"
                    templateUrl={`/schools/${school.id}/teachers/template?department=${importDept.id}`}
                    previewUrl={`/schools/${school.id}/teachers/import/preview?department=${importDept.id}`}
                    storeUrl={`/schools/${school.id}/teachers/import?department=${importDept.id}`}
                    baseUrl={`/schools/${school.id}`}
                    data={teacherImport?.department_id === importDept.id ? teacherImport : undefined}
                    disabled={!isEditable}
                    disabledHint="الاستيراد متاح فقط في العام الدراسي النشط."
                    deactivateHint={(n) =>
                        `المزامنة: ${n} معلم في هذه المدرسة وغير مذكور في الملف سيصبح «غير نشط» (لن يُحذف؛ يُعاد تفعيله إن عاد أو انتقل لمدرسة أخرى).`
                    }
                    columns={[
                        { key: 'name', label: 'اسم الموظف' },
                        { key: 'national_id', label: 'الرقم الشخصي' },
                        { key: 'employee_no', label: 'الرقم الوظيفي' },
                        { key: 'job_title', label: 'المسمى' },
                        { key: 'specialization', label: 'التخصص' },
                    ]}
                />
            )}

            <GradesEditor
                key={gradesFor?.id}
                teacher={gradesFor}
                schoolId={school.id}
                gradesByStage={gradesByStage}
                onClose={() => setGradesFor(null)}
            />
        </AppLayout>
    );
}

/** بطاقة مادة/قسم: ترويسة بالاسم والعدد وأزرار التصدير/الاستيراد، وبداخلها بطاقات المعلمين. */
function DepartmentCard({
    dept,
    schoolId,
    onImport,
    onGrades,
}: Readonly<{
    dept: DepartmentGroup;
    schoolId: number;
    onImport: () => void;
    onGrades: (t: Teacher) => void;
}>) {
    // المنسق أولًا، ثم بقية المعلمين أبجديًا
    const byCoordinatorThenName = (a: Teacher, b: Teacher) =>
        Number(!!b.is_coordinator) - Number(!!a.is_coordinator) || a.name.localeCompare(b.name, 'ar');
    const active = dept.teachers.filter((t) => t.is_active).sort(byCoordinatorThenName);
    const inactive = dept.teachers.filter((t) => !t.is_active).sort(byCoordinatorThenName);

    return (
        <Card>
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0 border-b">
                <div className="flex items-center gap-2">
                    <BookOpen className="text-muted-foreground size-5" />
                    <CardTitle className="text-base">{dept.name}</CardTitle>
                    <Badge variant="secondary">{active.length}</Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" asChild>
                        <a href={`/schools/${schoolId}/teachers/export?department=${dept.id}`}>
                            <Download className="size-4" /> تصدير
                        </a>
                    </Button>
                    {dept.canImport && (
                        <Button variant="outline" size="sm" onClick={onImport}>
                            <Upload className="size-4" /> استيراد
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="pt-6">
                {active.length === 0 && inactive.length === 0 ? (
                    <div className="text-muted-foreground flex flex-col items-center gap-1 py-8 text-center text-sm">
                        <Users className="size-6 opacity-50" />
                        لا يوجد معلمون في هذه المادة بعد{dept.canImport ? ' — استورد بيانات القسم' : ''}
                    </div>
                ) : (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {active.map((t) => (
                            <TeacherCard key={t.id} teacher={t} schoolId={schoolId} canManage={dept.canImport} onGrades={onGrades} />
                        ))}
                    </div>
                )}

                {inactive.length > 0 && (
                    <details className="mt-4">
                        <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-sm font-medium">
                            غير النشطين ({inactive.length})
                        </summary>
                        <div className="mt-3 grid gap-3 opacity-75 sm:grid-cols-2 xl:grid-cols-3">
                            {inactive.map((t) => (
                                <TeacherCard key={t.id} teacher={t} schoolId={schoolId} canManage={dept.canImport} onGrades={onGrades} />
                            ))}
                        </div>
                    </details>
                )}
            </CardContent>
        </Card>
    );
}

/** بطاقة معلم — بطاقة المنسق بلون ذهبي مميّز عن باقي المعلمين. */
function TeacherCard({
    teacher: t,
    schoolId,
    canManage,
    onGrades,
}: Readonly<{
    teacher: Teacher;
    schoolId: number;
    canManage: boolean;
    onGrades: (t: Teacher) => void;
}>) {
    const isCoord = !!t.is_coordinator;

    return (
        <Card
            className={cn(
                'flex h-full flex-col gap-3 p-4',
                isCoord &&
                    'border-amber-400 bg-amber-50 ring-1 ring-amber-300/60 dark:border-amber-500/50 dark:bg-amber-500/10 dark:ring-amber-500/30',
            )}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                        {isCoord && <Crown className="size-4 shrink-0 text-amber-500" />}
                        <Link
                            href={`/schools/${schoolId}/teachers/${t.id}`}
                            className={cn(
                                'font-semibold hover:underline',
                                isCoord ? 'text-amber-700 dark:text-amber-300' : 'text-primary',
                            )}
                        >
                            {t.name}
                        </Link>
                    </div>
                    {!t.is_active &&
                        (t.transferred_to ? (
                            <span className="text-warning text-xs">حُوِّل إلى: {t.transferred_to}</span>
                        ) : (
                            <span className="text-muted-foreground text-xs">غير نشط (مستقيل/غير معروف)</span>
                        ))}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                    {isCoord && (
                        <Badge className="border-transparent bg-amber-400 text-amber-950 hover:bg-amber-400">منسق المادة</Badge>
                    )}
                    {t.job_title && <Badge variant="secondary">{t.job_title}</Badge>}
                </div>
            </div>
            <dl className="text-muted-foreground grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                <div className="flex flex-col">
                    <dt className="text-xs">الرقم الشخصي</dt>
                    <dd className="text-foreground tnum">{t.national_id || '—'}</dd>
                </div>
                <div className="flex flex-col">
                    <dt className="text-xs">الرقم الوظيفي</dt>
                    <dd className="text-foreground tnum">{t.employee_no || '—'}</dd>
                </div>
                <div className="col-span-2 flex flex-col">
                    <dt className="text-xs">التخصص</dt>
                    <dd className="text-foreground">{t.specialization || '—'}</dd>
                </div>
            </dl>
            {t.grades?.length ? (
                <div className="flex flex-wrap gap-1">
                    {t.grades.map((g) => (
                        <Badge key={g.id} variant="secondary">
                            {g.name}
                        </Badge>
                    ))}
                </div>
            ) : null}
            {canManage && (
                <div className="border-border/60 mt-auto border-t pt-2">
                    <Button variant="ghost" size="sm" onClick={() => onGrades(t)}>
                        <GraduationCap className="size-4" /> الصفوف
                    </Button>
                </div>
            )}
        </Card>
    );
}

/** محرّر الصفوف التي يدرّسها المعلم (مربعات اختيار مجمّعة حسب المرحلة). */
function GradesEditor({
    teacher,
    schoolId,
    gradesByStage,
    onClose,
}: Readonly<{
    teacher: Teacher | null;
    schoolId: number;
    gradesByStage: [string, Grade[]][];
    onClose: () => void;
}>) {
    const [selected, setSelected] = useState<Set<number>>(new Set(teacher?.grades?.map((g) => g.id) ?? []));
    const [saving, setSaving] = useState(false);

    const toggle = (id: number) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const save = () => {
        if (!teacher) return;
        setSaving(true);
        router.put(
            `/schools/${schoolId}/teachers/${teacher.id}/grades`,
            { grade_ids: Array.from(selected) },
            {
                preserveScroll: true,
                onFinish: () => setSaving(false),
                onSuccess: () => {
                    toast.success('تم تحديث صفوف المعلم');
                    onClose();
                },
            },
        );
    };

    return (
        <FormDialog
            open={!!teacher}
            onOpenChange={(o) => !o && onClose()}
            title={`صفوف المعلم: ${teacher?.name ?? ''}`}
            description="حدّد الصفوف التي يدرّسها المعلم في العام الحالي"
            submitLabel="حفظ الصفوف"
            loading={saving}
            onSubmit={(e) => {
                e.preventDefault();
                save();
            }}
        >
            <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
                {gradesByStage.map(([stage, list]) => (
                    <div key={stage} className="space-y-2">
                        <p className="text-muted-foreground text-xs font-semibold">{stage}</p>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {list.map((g) => (
                                <label
                                    key={g.id}
                                    className="hover:bg-accent flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm"
                                >
                                    <Checkbox checked={selected.has(g.id)} onCheckedChange={() => toggle(g.id)} />
                                    {g.name}
                                </label>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </FormDialog>
    );
}
