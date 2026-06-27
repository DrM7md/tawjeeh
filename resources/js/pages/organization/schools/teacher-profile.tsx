import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/utils';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { CalendarDays, ChevronDown, ChevronLeft, Crown, GraduationCap, TrendingUp, UserRound } from 'lucide-react';
import { useState } from 'react';

interface VisitRow {
    id: number;
    date: string | null;
    semester: string | null;
    supervisor: string;
    visit_type: string;
    status: 'draft' | 'final' | null;
    level: number | null;
    axes: Record<string, number> | null;
}
interface YearGroup {
    year_id: number | null;
    year_name: string;
    is_active: boolean;
    visits_count: number;
    average: number | null;
    visits: VisitRow[];
}
interface PageProps {
    school: { id: number; name: string };
    teacher: {
        id: number;
        name: string;
        national_id: string | null;
        employee_no: string | null;
        gender: 'male' | 'female' | null;
        nationality: string | null;
        birth_date: string | null;
        job_title: string | null;
        academic_degree: string | null;
        specialization: string | null;
        ministry_hire_date: string | null;
        license_level: string | null;
        license_year: string | null;
        residential_zone: string | null;
        sections_count: number | null;
        quota: number | null;
        phone: string | null;
        email: string | null;
        is_active: boolean;
        stage: string | null;
        department: string | null;
        classification: string | null;
        grades: { id: number; name: string }[];
        coordination: { since: string | null; tenure: string } | null;
    };
    years: YearGroup[];
    overall: { total_visits: number; years_count: number; average: number | null; last_visit: string | null };
    defaultAxes: string[];
}

const genderLabels: Record<string, string> = { male: 'ذكر', female: 'أنثى' };

/** لون/تسمية المستوى من متوسط المحاور (1–5). */
function levelMeta(level: number | null): { label: string; className: string } {
    if (level === null) return { label: 'لم تُقيَّم', className: 'bg-muted text-muted-foreground' };
    if (level >= 4.5) return { label: 'ممتاز', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' };
    if (level >= 3.5) return { label: 'جيد جدًا', className: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' };
    if (level >= 2.5) return { label: 'جيد', className: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' };
    if (level >= 1.5) return { label: 'مقبول', className: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300' };
    return { label: 'ضعيف', className: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' };
}

function LevelBadge({ level }: { level: number | null }) {
    const meta = levelMeta(level);
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${meta.className}`}>
            {level !== null && <span className="tnum font-semibold">{level.toFixed(1)}</span>}
            {meta.label}
        </span>
    );
}

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
    final: { label: 'معتمدة', variant: 'default' },
    draft: { label: 'مسودة', variant: 'secondary' },
};

export default function TeacherProfile({ school, teacher, years, overall, defaultAxes }: Readonly<PageProps>) {
    const [showMore, setShowMore] = useState(false);
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'لوحة التحكم', href: '/dashboard' },
        { title: 'المدارس', href: '/schools' },
        { title: school.name, href: `/schools/${school.id}` },
        { title: teacher.name, href: `/schools/${school.id}/teachers/${teacher.id}` },
    ];

    const num = (v: number | null) => (v !== null && v !== undefined ? String(v) : null);
    // الأساسية تظهر دائمًا، والبقية خلف «إظهار المزيد».
    const primaryInfo = [
        { label: 'الرقم الشخصي', value: teacher.national_id },
        { label: 'الرقم الوظيفي', value: teacher.employee_no },
        { label: 'المسمى الوظيفي', value: teacher.job_title },
        { label: 'التخصص', value: teacher.specialization },
        { label: 'القسم', value: teacher.department },
        { label: 'المرحلة', value: teacher.stage },
        { label: 'التصنيف', value: teacher.classification },
    ];
    const moreInfo = [
        { label: 'الجنس', value: teacher.gender ? genderLabels[teacher.gender] : null },
        { label: 'الجنسية', value: teacher.nationality },
        { label: 'تاريخ الميلاد', value: teacher.birth_date ? formatDate(teacher.birth_date) : null },
        { label: 'المؤهل العلمي', value: teacher.academic_degree },
        { label: 'تاريخ التعيين بالوزارة', value: teacher.ministry_hire_date ? formatDate(teacher.ministry_hire_date) : null },
        { label: 'مستوى الرخصة', value: teacher.license_level },
        { label: 'سنة الرخصة', value: teacher.license_year },
        { label: 'منطقة السكن', value: teacher.residential_zone },
        { label: 'عدد الشُّعب', value: num(teacher.sections_count) },
        { label: 'النصاب', value: num(teacher.quota) },
        { label: 'الجوال', value: teacher.phone },
        { label: 'البريد الإلكتروني', value: teacher.email },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={teacher.name} />
            <div className="flex flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    title={teacher.name}
                    description={`الملف الشخصي للمعلم — ${school.name}`}
                    backHref={`/schools/${school.id}`}
                    actions={
                        <div className="flex flex-wrap items-center gap-2">
                            {teacher.coordination && (
                                <Badge className="border-transparent bg-amber-400 text-amber-950 hover:bg-amber-400">
                                    <Crown className="ml-1 size-3.5" /> منسق المادة
                                </Badge>
                            )}
                            {!teacher.is_active && (
                                <Badge variant="outline" className="text-muted-foreground">
                                    غير نشط
                                </Badge>
                            )}
                        </div>
                    }
                />

                {/* بيانات المعلم */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <UserRound className="size-4" /> بيانات المعلم
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {teacher.coordination && (
                            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm dark:border-amber-500/40 dark:bg-amber-500/10">
                                <Crown className="size-4 text-amber-500" />
                                <span className="font-medium text-amber-800 dark:text-amber-300">منسق المادة</span>
                                <span className="text-muted-foreground">
                                    مدة التكليف: {teacher.coordination.tenure}
                                    {teacher.coordination.since && ` — منذ ${formatDate(teacher.coordination.since)}`}
                                </span>
                            </div>
                        )}
                        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
                            {(showMore ? [...primaryInfo, ...moreInfo] : primaryInfo).map((it) => (
                                <div key={it.label} className="space-y-0.5">
                                    <dt className="text-muted-foreground text-xs">{it.label}</dt>
                                    <dd className="text-sm font-medium">{it.value || '—'}</dd>
                                </div>
                            ))}
                        </dl>
                        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setShowMore((v) => !v)}>
                            <ChevronDown className={`size-4 transition-transform ${showMore ? 'rotate-180' : ''}`} />
                            {showMore ? 'إظهار أقل' : 'إظهار المزيد'}
                        </Button>
                        {teacher.grades.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5">
                                <GraduationCap className="text-muted-foreground size-4" />
                                {teacher.grades.map((g) => (
                                    <Badge key={g.id} variant="secondary">
                                        {g.name}
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* ملخص عام */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard icon={<CalendarDays className="size-4" />} label="إجمالي الزيارات" value={String(overall.total_visits)} />
                    <StatCard icon={<TrendingUp className="size-4" />} label="عدد الأعوام" value={String(overall.years_count)} />
                    <Card>
                        <CardContent className="flex flex-col gap-1.5 p-4">
                            <span className="text-muted-foreground text-xs">متوسط المستوى العام</span>
                            <LevelBadge level={overall.average} />
                        </CardContent>
                    </Card>
                    <StatCard
                        icon={<CalendarDays className="size-4" />}
                        label="آخر زيارة"
                        value={overall.last_visit ? formatDate(overall.last_visit) : '—'}
                    />
                </div>

                {/* سجل الزيارات عبر الأعوام */}
                <div className="flex flex-col gap-4">
                    <h2 className="text-lg font-semibold">سجل الزيارات والمستوى عبر الأعوام</h2>
                    {years.length === 0 && (
                        <Card>
                            <CardContent className="text-muted-foreground p-8 text-center text-sm">لا توجد زيارات مسجّلة لهذا المعلم بعد.</CardContent>
                        </Card>
                    )}
                    {years.map((year) => (
                        <YearSection key={year.year_id ?? year.year_name} year={year} defaultAxes={defaultAxes} />
                    ))}
                </div>
            </div>
        </AppLayout>
    );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <Card>
            <CardContent className="flex flex-col gap-1.5 p-4">
                <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                    {icon}
                    {label}
                </span>
                <span className="text-xl font-semibold">{value}</span>
            </CardContent>
        </Card>
    );
}

function YearSection({ year, defaultAxes }: { year: YearGroup; defaultAxes: string[] }) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
                <CardTitle className="flex items-center gap-2 text-base">
                    {year.year_name}
                    {year.is_active && <Badge variant="secondary">العام النشط</Badge>}
                    <span className="text-muted-foreground text-sm font-normal">({year.visits_count} زيارة)</span>
                </CardTitle>
                <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs">متوسط العام</span>
                    <LevelBadge level={year.average} />
                </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
                {year.visits.map((v) => (
                    <VisitItem key={v.id} visit={v} defaultAxes={defaultAxes} />
                ))}
            </CardContent>
        </Card>
    );
}

function VisitItem({ visit, defaultAxes }: { visit: VisitRow; defaultAxes: string[] }) {
    const [open, setOpen] = useState(false);
    const status = visit.status ? statusLabels[visit.status] : null;
    const hasAxes = !!visit.axes && Object.keys(visit.axes).length > 0;

    return (
        <div className="rounded-xl border border-border/60">
            <button
                type="button"
                onClick={() => hasAxes && setOpen((o) => !o)}
                className={`flex w-full flex-wrap items-center gap-x-4 gap-y-2 p-3 text-right ${hasAxes ? 'hover:bg-accent cursor-pointer' : 'cursor-default'}`}
            >
                <div className="flex min-w-32 flex-col">
                    <span className="text-sm font-medium">{visit.date ? formatDate(visit.date) : '—'}</span>
                    {visit.semester && <span className="text-muted-foreground text-xs">{visit.semester}</span>}
                </div>
                <div className="flex min-w-40 flex-col">
                    <span className="text-muted-foreground text-xs">الموجّه الزائر</span>
                    <span className="text-sm">{visit.supervisor}</span>
                </div>
                <div className="flex-1" />
                {status && <Badge variant={status.variant}>{status.label}</Badge>}
                <LevelBadge level={visit.level} />
                <Link
                    href={`/visits/${visit.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-primary inline-flex items-center gap-0.5 text-xs hover:underline"
                >
                    الاستمارة
                    <ChevronLeft className="size-3.5" />
                </Link>
            </button>

            {open && hasAxes && (
                <div className="border-t border-border/60 p-3">
                    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                        {defaultAxes.map((axis) => {
                            const score = visit.axes?.[axis] ?? 0;
                            return (
                                <div key={axis} className="flex items-center justify-between gap-3 text-sm">
                                    <dt className="text-muted-foreground">{axis}</dt>
                                    <dd className="tnum font-medium">{score > 0 ? `${score} / 5` : '—'}</dd>
                                </div>
                            );
                        })}
                    </dl>
                </div>
            )}
        </div>
    );
}
