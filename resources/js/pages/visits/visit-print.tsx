import { Head } from '@inertiajs/react';
import { useEffect } from 'react';

interface StandardRow {
    name: string;
    rating: number;
    recommendation: string | null;
}
interface DomainRow {
    name: string;
    percent: number | null;
    standards: StandardRow[];
}
interface PageProps {
    visit: {
        school: string | null;
        department: string | null;
        supervisor: string | null;
        teacher: string | null;
        visit_date: string | null;
        visit_number: number | null;
        follow_up_type: string | null;
        section: string | null;
        lesson_topic: string | null;
        overall_rating: number | null;
    };
    domains: DomainRow[];
    ratingLabels: Record<string, string>;
    generalNotes: string | null;
}

function ratingColor(v: number): string {
    return ({ 4: '#16a34a', 3: '#2563eb', 2: '#d97706', 1: '#dc2626' } as Record<number, string>)[v] ?? '#9ca3af';
}
function pctColor(v: number | null): string {
    if (v == null) return '#9ca3af';
    if (v >= 90) return '#16a34a';
    if (v >= 75) return '#2563eb';
    if (v >= 60) return '#d97706';
    if (v >= 50) return '#ea580c';
    return '#dc2626';
}

export default function VisitPrint({ visit, domains, ratingLabels, generalNotes }: PageProps) {
    useEffect(() => {
        const t = setTimeout(() => window.print(), 500);
        return () => clearTimeout(t);
    }, []);

    const info: [string, string | number | null][] = [
        ['المدرسة', visit.school],
        ['المادة/القسم', visit.department],
        ['المعلم', visit.teacher],
        ['الموجّه (الزائر)', visit.supervisor],
        ['التاريخ', visit.visit_date],
        ['نوع المتابعة', visit.follow_up_type],
        ['الشعبة', visit.section],
        ['موضوع الدرس', visit.lesson_topic],
        ['رقم الزيارة', visit.visit_number],
    ];

    return (
        <div dir="rtl" style={{ padding: 24, color: '#111', background: '#fff', fontFamily: 'inherit' }}>
            <Head title={`استمارة زيارة — ${visit.teacher ?? ''}`} />
            <style>{`
                @media print { .no-print { display: none } @page { margin: 14mm } }
                .vp-table { border-collapse: collapse; width: 100%; font-size: 13px }
                .vp-table th, .vp-table td { border: 1px solid #d1d5db; padding: 6px 8px; vertical-align: top }
                .vp-table th { background: #7b1c2e; color: #fff }
                .vp-domain td { background: #f3f4f6; font-weight: bold }
            `}</style>

            {/* الترويسة */}
            <div style={{ textAlign: 'center', borderBottom: '2px solid #7b1c2e', paddingBottom: 12, marginBottom: 16 }}>
                <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: '#7b1c2e' }}>استمارة الإشراف على أداء المعلم</h1>
                <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 13 }}>الزيارة الصفية</p>
            </div>

            {/* التقييم الكلي */}
            {visit.overall_rating != null && (
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                    <span style={{ display: 'inline-block', border: `2px solid ${pctColor(visit.overall_rating)}`, borderRadius: 12, padding: '8px 24px' }}>
                        <span style={{ fontSize: 28, fontWeight: 900, color: pctColor(visit.overall_rating) }}>{visit.overall_rating}%</span>
                        <span style={{ display: 'block', fontSize: 11, color: '#6b7280' }}>التقييم الكلي</span>
                    </span>
                </div>
            )}

            {/* بيانات الزيارة */}
            <table className="vp-table" style={{ marginBottom: 16 }}>
                <tbody>
                    {[0, 1, 2].map((row) => (
                        <tr key={row}>
                            {info.slice(row * 3, row * 3 + 3).map(([label, value]) => (
                                <td key={label} style={{ width: '33.33%' }}>
                                    <span style={{ color: '#6b7280', fontSize: 11 }}>{label}</span>
                                    <br />
                                    <b>{value ?? '—'}</b>
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* المعايير */}
            <table className="vp-table">
                <thead>
                    <tr>
                        <th style={{ width: '45%', textAlign: 'right' }}>المعيار</th>
                        <th style={{ width: '15%' }}>التقدير</th>
                        <th style={{ textAlign: 'right' }}>التوصية</th>
                    </tr>
                </thead>
                <tbody>
                    {domains.map((d, di) => (
                        <FragmentRows key={di} domain={d} ratingLabels={ratingLabels} index={di} />
                    ))}
                </tbody>
            </table>

            {/* ملاحظات عامة */}
            {generalNotes && (
                <div style={{ marginTop: 16, border: '1px solid #d1d5db', borderRadius: 8, padding: 12 }}>
                    <h3 style={{ margin: '0 0 6px', fontSize: 14 }}>ملاحظات وتوصيات عامة</h3>
                    <p style={{ margin: 0, fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{generalNotes}</p>
                </div>
            )}

            {/* التوقيع */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 40, fontSize: 13 }}>
                <div style={{ textAlign: 'center' }}>الموجّه (الزائر)<br /><br />{visit.supervisor ?? '............'}</div>
                <div style={{ textAlign: 'center' }}>توقيع المعلم<br /><br />............</div>
            </div>

            <button className="no-print" onClick={() => window.print()} style={{ position: 'fixed', top: 16, left: 16, padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}>
                طباعة
            </button>
        </div>
    );
}

function FragmentRows({ domain, ratingLabels, index }: { domain: DomainRow; ratingLabels: Record<string, string>; index: number }) {
    return (
        <>
            <tr className="vp-domain">
                <td colSpan={2}>المجال {index + 1}: {domain.name}</td>
                <td style={{ textAlign: 'center', color: pctColor(domain.percent), fontWeight: 700 }}>{domain.percent != null ? `${domain.percent}%` : '—'}</td>
            </tr>
            {domain.standards.map((s, si) => (
                <tr key={si}>
                    <td style={{ textAlign: 'right' }}>{s.name}</td>
                    <td style={{ textAlign: 'center', color: s.rating > 0 ? ratingColor(s.rating) : '#9ca3af', fontWeight: 700 }}>
                        {s.rating > 0 ? ratingLabels[String(s.rating)] : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontSize: 12 }}>{s.recommendation ?? '—'}</td>
                </tr>
            ))}
        </>
    );
}
