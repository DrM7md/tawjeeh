import { Head } from '@inertiajs/react';
import { useEffect } from 'react';

type ReportType = 'department' | 'comparison' | 'performance' | 'coverage' | 'recommendations' | 'cross-year';

const TITLES: Record<ReportType, string> = {
    department: 'تقرير أداء الأقسام',
    comparison: 'تقرير مقارنة أداء المعلمين',
    performance: 'تقرير أداء المعلم عبر الزيارات',
    coverage: 'تقرير تغطية الزيارات الإشرافية',
    recommendations: 'تقرير متابعة تنفيذ التوصيات',
    'cross-year': 'الإحصائيات الشاملة عبر الأعوام',
};

function tone(v: number | null | undefined): string {
    if (v == null) return '#9ca3af';
    if (v >= 90) return '#16a34a';
    if (v >= 75) return '#2563eb';
    if (v >= 60) return '#d97706';
    if (v >= 50) return '#ea580c';
    return '#dc2626';
}
const pct = (v: number | null | undefined) => (v == null ? '—' : `${v}%`);

export default function ReportPrint({ type, report }: { type: ReportType; report: any }) {
    useEffect(() => {
        const t = setTimeout(() => window.print(), 400);
        return () => clearTimeout(t);
    }, []);

    return (
        <div dir="rtl" className="report-print" style={{ fontFamily: 'inherit', padding: 24, color: '#111', background: '#fff' }}>
            <Head title={TITLES[type]} />
            <style>{`@media print { .no-print { display:none } } table{border-collapse:collapse;width:100%;font-size:13px} th,td{border:1px solid #d1d5db;padding:6px 8px} th{background:#7b1c2e;color:#fff} tfoot td{background:#eff6ff;font-weight:bold}`}</style>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{TITLES[type]}</h1>
                    {report?.academicYear && <p style={{ color: '#6b7280', margin: '4px 0 0' }}>العام الأكاديمي {report.academicYear}</p>}
                    {type !== 'department' && report?.subject_name && <p style={{ color: '#6b7280', margin: '4px 0 0' }}>{report.subject_name}</p>}
                </div>
                <button className="no-print" onClick={() => window.print()} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db', cursor: 'pointer' }}>
                    طباعة
                </button>
            </div>

            {type === 'department' && <Department report={report} />}
            {type === 'comparison' && <Comparison report={report} />}
            {type === 'performance' && <Performance report={report} />}
            {type === 'coverage' && <Coverage report={report} />}
            {type === 'recommendations' && <Recommendations report={report} />}
            {type === 'cross-year' && <CrossYear report={report} />}
        </div>
    );
}

function Coverage({ report }: { report: any }) {
    return (
        <>
            <p style={{ marginBottom: 8 }}>تمت زيارة <b>{report.summary?.teachersVisited}</b> من {report.summary?.teachersTotal} معلماً — المتبقّي {report.summary?.teachersTotal - report.summary?.teachersVisited}</p>
            <table>
                <thead>
                    <tr>
                        <th style={{ textAlign: 'right' }}>المعلم</th>
                        <th>الحالة</th>
                        <th>عدد الزيارات</th>
                        <th>آخر زيارة</th>
                    </tr>
                </thead>
                <tbody>
                    {report.teacherCoverage.map((t: any, i: number) => (
                        <tr key={i}>
                            <td style={{ textAlign: 'right' }}>{t.name}</td>
                            <td style={{ textAlign: 'center', color: t.visited ? '#16a34a' : '#d97706', fontWeight: 700 }}>{t.visited ? 'تمت' : 'لم تتم'}</td>
                            <td style={{ textAlign: 'center' }}>{t.visits}</td>
                            <td style={{ textAlign: 'center' }}>{t.last_visit ?? '—'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </>
    );
}

function Recommendations({ report }: { report: any }) {
    const data = report?.data;
    if (!data) return <p>اختر معلماً.</p>;
    const statuses = report.followupStatuses ?? {};
    return (
        <>
            <p style={{ marginBottom: 8 }}><b>{data.teacher_name}</b> — {data.subject_name} · {data.visits.length} زيارة</p>
            {data.visits.map((v: any, vi: number) => (
                <div key={v.id} style={{ marginBottom: 16, breakInside: 'avoid' }}>
                    <h3 style={{ fontSize: 14, margin: '0 0 6px' }}>الزيارة {vi + 1} — {v.visit_date} ({v.visitor})</h3>
                    <table>
                        <thead>
                            <tr><th style={{ textAlign: 'right' }}>المجال</th><th style={{ textAlign: 'right' }}>التوصيات</th><th>المتابعة</th></tr>
                        </thead>
                        <tbody>
                            {data.domains.map((d: any) => {
                                const dd = v.domains[d.id];
                                return (
                                    <tr key={d.id}>
                                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{d.name}</td>
                                        <td style={{ textAlign: 'right' }}>{dd?.recommendations?.length ? dd.recommendations.join(' / ') : '—'}</td>
                                        <td style={{ textAlign: 'center' }}>{statuses[dd?.followup_status] ?? '—'}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ))}
        </>
    );
}

function CrossYear({ report }: { report: any }) {
    if (!report?.yearSummaries?.length) return <p>لا توجد بيانات.</p>;
    return (
        <>
            <h3 style={{ fontSize: 15 }}>ملخص الأعوام</h3>
            <table style={{ marginBottom: 16 }}>
                <thead>
                    <tr><th style={{ textAlign: 'right' }}>العام</th><th>الزيارات</th><th>المعدّل</th><th>المعلمون</th><th>الأقسام</th></tr>
                </thead>
                <tbody>
                    {report.yearSummaries.map((s: any) => (
                        <tr key={s.year_id}>
                            <td style={{ textAlign: 'right' }}>{s.year_name}</td>
                            <td style={{ textAlign: 'center' }}>{s.total_visits}</td>
                            <td style={{ textAlign: 'center', color: tone(s.avg_rating), fontWeight: 700 }}>{pct(s.avg_rating)}</td>
                            <td style={{ textAlign: 'center' }}>{s.teacher_count}</td>
                            <td style={{ textAlign: 'center' }}>{s.subject_count}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {report.ratingDistribution?.length > 0 && (
                <>
                    <h3 style={{ fontSize: 15 }}>توزيع التقديرات</h3>
                    <table>
                        <thead>
                            <tr><th style={{ textAlign: 'right' }}>العام</th><th>ممتاز</th><th>جيد جدًا</th><th>جيد</th><th>مقبول</th><th>ضعيف</th><th>الإجمالي</th></tr>
                        </thead>
                        <tbody>
                            {report.ratingDistribution.map((rd: any) => (
                                <tr key={rd.year_id}>
                                    <td style={{ textAlign: 'right' }}>{rd.year_name}</td>
                                    <td style={{ textAlign: 'center' }}>{rd.excellent}</td>
                                    <td style={{ textAlign: 'center' }}>{rd.very_good}</td>
                                    <td style={{ textAlign: 'center' }}>{rd.good}</td>
                                    <td style={{ textAlign: 'center' }}>{rd.acceptable}</td>
                                    <td style={{ textAlign: 'center' }}>{rd.weak}</td>
                                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{rd.total}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </>
            )}
        </>
    );
}

function Department({ report }: { report: any }) {
    return (
        <table>
            <thead>
                <tr>
                    <th style={{ textAlign: 'right' }}>القسم</th>
                    <th>الزيارات</th>
                    <th>المقيّمة</th>
                    <th>المتوسط</th>
                </tr>
            </thead>
            <tbody>
                {report.subjects.map((s: any) => (
                    <tr key={s.id}>
                        <td style={{ textAlign: 'right' }}>{s.name}</td>
                        <td style={{ textAlign: 'center' }}>{s.total_visits}</td>
                        <td style={{ textAlign: 'center' }}>{s.rated_visits}</td>
                        <td style={{ textAlign: 'center', color: tone(s.average_rating), fontWeight: 700 }}>{pct(s.average_rating)}</td>
                    </tr>
                ))}
            </tbody>
            <tfoot>
                <tr>
                    <td style={{ textAlign: 'right' }}>الإجمالي</td>
                    <td style={{ textAlign: 'center' }}>{report.totals.total}</td>
                    <td style={{ textAlign: 'center' }}>{report.totals.rated}</td>
                    <td style={{ textAlign: 'center', color: tone(report.totals.average) }}>{pct(report.totals.average)}</td>
                </tr>
            </tfoot>
        </table>
    );
}

function Comparison({ report }: { report: any }) {
    if (!report?.domains?.length) return <p>لا توجد بيانات.</p>;
    return (
        <table>
            <thead>
                <tr>
                    <th style={{ textAlign: 'right' }}>المعلم</th>
                    <th>الزيارات</th>
                    {report.domains.map((d: any) => <th key={d.id}>{d.name}</th>)}
                    <th>العام</th>
                </tr>
            </thead>
            <tbody>
                {report.teachers.map((t: any) => (
                    <tr key={t.id}>
                        <td style={{ textAlign: 'right' }}>{t.name}</td>
                        <td style={{ textAlign: 'center' }}>{t.visit_count}</td>
                        {report.domains.map((d: any) => <td key={d.id} style={{ textAlign: 'center', color: tone(t.domain_ratings[d.id]), fontWeight: 700 }}>{pct(t.domain_ratings[d.id])}</td>)}
                        <td style={{ textAlign: 'center', color: tone(t.overall), fontWeight: 700 }}>{pct(t.overall)}</td>
                    </tr>
                ))}
            </tbody>
            <tfoot>
                <tr>
                    <td style={{ textAlign: 'right' }} colSpan={2}>معدّل القسم</td>
                    {report.domains.map((d: any) => <td key={d.id} style={{ textAlign: 'center' }}>{pct(report.domain_averages[d.id])}</td>)}
                    <td style={{ textAlign: 'center' }}>{pct(report.overall_average)}</td>
                </tr>
            </tfoot>
        </table>
    );
}

function Performance({ report }: { report: any }) {
    if (!report?.domains?.length) return <p>لا توجد بيانات.</p>;
    return (
        <>
            <p style={{ marginBottom: 8 }}><b>{report.teacher_name}</b> — {report.visit_count} زيارة ({report.date_range?.from} ← {report.date_range?.to})</p>
            <table>
                <thead>
                    <tr>
                        <th style={{ textAlign: 'right' }}>الزيارة</th>
                        {report.domains.map((d: any) => <th key={d.id}>{d.name}</th>)}
                        <th>العام</th>
                    </tr>
                </thead>
                <tbody>
                    {report.visits.map((v: any) => (
                        <tr key={v.id}>
                            <td style={{ textAlign: 'right' }}>{v.date}<br /><span style={{ color: '#6b7280', fontSize: 11 }}>{v.year} · {v.visitor}</span></td>
                            {report.domains.map((d: any) => <td key={d.id} style={{ textAlign: 'center', color: tone(v.domain_ratings[d.id]), fontWeight: 700 }}>{pct(v.domain_ratings[d.id])}</td>)}
                            <td style={{ textAlign: 'center', color: tone(v.overall), fontWeight: 700 }}>{pct(v.overall)}</td>
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr>
                        <td style={{ textAlign: 'right' }}>المعدّل</td>
                        {report.domains.map((d: any) => <td key={d.id} style={{ textAlign: 'center' }}>{pct(report.domain_averages[d.id])}</td>)}
                        <td style={{ textAlign: 'center' }}>{pct(report.overall_average)}</td>
                    </tr>
                </tfoot>
            </table>
        </>
    );
}
