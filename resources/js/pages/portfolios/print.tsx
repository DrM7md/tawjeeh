import { formatDate } from '@/lib/utils';
import { type PortfolioReview } from '@/types';
import { Head } from '@inertiajs/react';
import { useEffect } from 'react';

interface PageProps {
    review: PortfolioReview;
}

export default function PortfolioPrint({ review }: Readonly<PageProps>) {
    useEffect(() => {
        const t = setTimeout(() => window.print(), 500);
        return () => clearTimeout(t);
    }, []);

    const scores = review.scores ?? [];
    const maxTotal = scores.reduce((a, s) => a + s.max_score, 0);

    const info: [string, string | number | null][] = [
        ['المنسق', review.coordinator?.name ?? null],
        ['المدرسة', review.coordinator?.school?.name ?? null],
        ['المادة', review.department?.name ?? null],
        ['الفصل', review.term === 'second' ? 'الفصل الثاني' : 'الفصل الأول'],
        ['التاريخ', formatDate(review.reviewed_at)],
        ['المقيِّم', review.supervisor?.name ?? null],
    ];

    return (
        <div dir="rtl" style={{ padding: 24, color: '#111', background: '#fff', fontFamily: 'inherit' }}>
            <Head title={`تقييم ملفات — ${review.coordinator?.name ?? ''}`} />
            <style>{`
                @media print { .no-print { display: none } @page { margin: 14mm } }
                .pp-table { border-collapse: collapse; width: 100%; font-size: 13px }
                .pp-table th, .pp-table td { border: 1px solid #d1d5db; padding: 6px 8px; vertical-align: top }
                .pp-table th { background: #7b1c2e; color: #fff }
            `}</style>

            {/* الترويسة */}
            <div style={{ textAlign: 'center', borderBottom: '2px solid #7b1c2e', paddingBottom: 12, marginBottom: 16 }}>
                <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: '#7b1c2e' }}>استمارة تقييم ملفات المنسق</h1>
                <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 13 }}>حافظة أعمال المنسق</p>
            </div>

            {/* الدرجة الكلية */}
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <span style={{ display: 'inline-block', border: '2px solid #7b1c2e', borderRadius: 12, padding: '8px 24px' }}>
                    <span style={{ fontSize: 28, fontWeight: 900, color: '#7b1c2e' }}>
                        {review.total_score ?? '—'} / {maxTotal}
                    </span>
                    <span style={{ display: 'block', fontSize: 11, color: '#6b7280' }}>الدرجة الكلية{review.result ? ` — ${review.result}` : ''}</span>
                </span>
            </div>

            {/* بيانات السجل */}
            <table className="pp-table" style={{ marginBottom: 16 }}>
                <tbody>
                    {[0, 1].map((row) => (
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

            {/* البنود */}
            <table className="pp-table">
                <thead>
                    <tr>
                        <th style={{ width: '8%' }}>#</th>
                        <th style={{ width: '47%', textAlign: 'right' }}>البند</th>
                        <th style={{ width: '15%' }}>الدرجة</th>
                        <th style={{ textAlign: 'right' }}>ملاحظة</th>
                    </tr>
                </thead>
                <tbody>
                    {scores.map((s, i) => (
                        <tr key={s.id}>
                            <td style={{ textAlign: 'center' }} className="tnum">
                                {i + 1}
                            </td>
                            <td style={{ textAlign: 'right' }}>{s.criterion_text}</td>
                            <td style={{ textAlign: 'center', fontWeight: 700 }} className="tnum">
                                {s.score ?? '—'} / {s.max_score}
                            </td>
                            <td style={{ textAlign: 'right', fontSize: 12 }}>
                                {s.note ?? '—'}
                                {s.attachment_name && <span style={{ color: '#6b7280' }}> (مرفق: {s.attachment_name})</span>}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* ملاحظات عامة */}
            {review.notes && (
                <div style={{ marginTop: 16, border: '1px solid #d1d5db', borderRadius: 8, padding: 12 }}>
                    <h3 style={{ margin: '0 0 6px', fontSize: 14 }}>ملاحظات عامة</h3>
                    <p style={{ margin: 0, fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{review.notes}</p>
                </div>
            )}

            {/* التوقيع */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 40, fontSize: 13 }}>
                <div style={{ textAlign: 'center' }}>
                    المقيِّم
                    <br />
                    <br />
                    {review.supervisor?.name ?? '............'}
                </div>
                <div style={{ textAlign: 'center' }}>
                    توقيع المنسق
                    <br />
                    <br />
                    ............
                </div>
            </div>

            <button
                className="no-print"
                onClick={() => window.print()}
                style={{ position: 'fixed', top: 16, left: 16, padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}
            >
                طباعة
            </button>
        </div>
    );
}
