import { PageHeader } from '@/components/shared/page-header';
import { BarCard, GaugeCard, PALETTE, PieCard, RadarCard, TrendCard, type Datum } from '@/components/shared/stat-charts';
import { StatCard } from '@/components/stat-card';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { CheckCircle2, ClipboardCheck, Gauge, School } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'لوحة التحكم', href: '/dashboard' },
    { title: 'تحكيم الاختبارات', href: '/reviews' },
    { title: 'الإحصائيات', href: '/reviews-statistics' },
];

interface Stats {
    kpis: { total: number; final: number; draft: number; finalizedPct: number; avgScore: number; maxScore: number; schools: number };
    byMonth: Datum[];
    byStatus: Datum[];
    byExam: Datum[];
    byDepartment: Datum[];
    byStage: Datum[];
    byGrade: Datum[];
    bySupervisor: Datum[];
    avgScoreByDept: Datum[];
    scoreDistribution: Datum[];
}

export default function ReviewsStatistics({ stats }: { stats: Stats }) {
    const k = stats.kpis;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="إحصائيات التحكيمات" />
            <div className="flex flex-col gap-6 p-4 md:p-6">
                <PageHeader title="إحصائيات التحكيمات" description="تحليل تحكيم الاختبارات حسب العام المختار" backHref="/reviews" />

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                        title="إجمالي التحكيمات"
                        value={k.total}
                        icon={ClipboardCheck}
                        tone="primary"
                        hint={`${k.final} معتمد · ${k.draft} مسودة`}
                    />
                    <StatCard
                        title="نسبة الاعتماد"
                        value={`${k.finalizedPct}%`}
                        icon={CheckCircle2}
                        tone={k.finalizedPct >= 70 ? 'success' : 'warning'}
                    />
                    <StatCard title="متوسط الدرجة" value={k.avgScore} icon={Gauge} tone="info" hint={`أعلى درجة ${k.maxScore}`} />
                    <StatCard title="المدارس المُحكَّمة" value={k.schools} icon={School} tone="warning" />
                </div>

                {/* الاتجاه الزمني */}
                <TrendCard title="تطوّر التحكيمات شهريًا" hint="عدد سجلات التحكيم في كل شهر" data={stats.byMonth} color={PALETTE[2]} height={280} />

                <div className="grid gap-6 lg:grid-cols-2">
                    <GaugeCard
                        title="مؤشرات الجودة"
                        hint="نسبة الاعتماد ومتوسط الدرجة مقارنةً بأعلى درجة"
                        items={[
                            { pct: k.finalizedPct, color: '#22C55E', label: 'نسبة الاعتماد', sub: `${k.final}/${k.total}` },
                            {
                                pct: k.maxScore ? (k.avgScore / k.maxScore) * 100 : 0,
                                color: PALETTE[1],
                                label: 'مستوى المتوسط',
                                sub: `${k.avgScore}/${k.maxScore}`,
                            },
                        ]}
                    />
                    <PieCard
                        title="حالة التحكيم"
                        hint="معتمد مقابل مسودة"
                        data={stats.byStatus}
                        colors={['#22C55E', '#FF9F0A']}
                        centerLabel="تحكيم"
                    />
                    <BarCard title="التحكيمات حسب الاختبار" hint="توزيع التحكيمات على الاختبارات الأربعة" data={stats.byExam} color={PALETTE[2]} />
                    {stats.avgScoreByDept.length >= 3 ? (
                        <RadarCard
                            title="متوسط الدرجة حسب المادة"
                            hint="معدّل درجات التحكيم لكل مادة"
                            data={stats.avgScoreByDept}
                            color={PALETTE[0]}
                            seriesName="متوسط الدرجة"
                        />
                    ) : (
                        <BarCard
                            title="متوسط الدرجة حسب المادة"
                            hint="معدّل درجات التحكيم لكل مادة"
                            data={stats.avgScoreByDept}
                            horizontal
                            color={PALETTE[0]}
                        />
                    )}
                    <BarCard title="توزيع الدرجات" hint="عدد التحكيمات في كل شريحة درجات" data={stats.scoreDistribution} color={PALETTE[1]} />
                    <PieCard title="التحكيمات حسب المادة" hint="توزيع التحكيمات على المواد" data={stats.byDepartment} centerLabel="تحكيم" />
                    <BarCard title="التحكيمات حسب المرحلة" data={stats.byStage} horizontal color={PALETTE[3]} />
                    <BarCard title="التحكيمات حسب الصف" data={stats.byGrade} horizontal color={PALETTE[4]} />
                    <BarCard
                        title="التحكيمات حسب الموجّه"
                        hint="أكثر الموجهين تحكيمًا"
                        data={stats.bySupervisor}
                        horizontal
                        color={PALETTE[5]}
                        className="lg:col-span-2"
                    />
                </div>
            </div>
        </AppLayout>
    );
}
