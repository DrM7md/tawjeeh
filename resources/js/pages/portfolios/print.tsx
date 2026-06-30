import { formatDate } from '@/lib/utils';
import { type PortfolioReview } from '@/types';
import { Head } from '@inertiajs/react';
import { useEffect } from 'react';

interface PageProps {
    review: PortfolioReview;
}

const MAROON = '#7b1c2e';

export default function PortfolioPrint({ review }: Readonly<PageProps>) {
    useEffect(() => {
        const t = setTimeout(() => window.print(), 500);
        return () => clearTimeout(t);
    }, []);

    const scores = review.scores ?? [];

    const weekday = review.reviewed_at ? new Intl.DateTimeFormat('ar', { weekday: 'long' }).format(new Date(review.reviewed_at)) : '—';

    // المعلومات الأساسية — صفوف من زوجين [وسم/قيمة] مطابقة للاستمارة
    const infoRows: [string, string | null, string, string | null][] = [
        ['المدرسة', review.coordinator?.school?.name ?? null, 'اليوم', weekday],
        ['المادة', review.department?.name ?? null, 'التاريخ', review.reviewed_at ? formatDate(review.reviewed_at) : null],
        ['المنسق', review.coordinator?.name ?? null, 'الموجه التربوي', review.supervisor?.name ?? null],
    ];

    return (
        <div dir="rtl" style={{ padding: 0, color: '#111', background: '#fff', fontFamily: 'inherit' }}>
            <Head title={`استمارة الإشراف على أداء المنسق — ${review.coordinator?.name ?? ''}`} />
            <style>{`
                @media print { .no-print { display: none } @page { margin: 12mm } }
                .ps-wrap { max-width: 900px; margin: 0 auto; padding: 16px }
                .ps-table { border-collapse: collapse; width: 100% }
                .ps-table td, .ps-table th { border: 1px solid #111; padding: 6px 8px; vertical-align: top; font-size: 12.5px }
                .ps-head th { background: ${MAROON}; color: #fff; text-align: center; font-weight: 700 }
                .ps-bar { background: ${MAROON}; color: #fff; text-align: center; font-weight: 700; padding: 6px; border: 1px solid #111; font-size: 14px }
                .ps-lbl { background: ${MAROON}; color: #fff; font-weight: 700; width: 14%; text-align: center }
                .ps-val { width: 36% }
            `}</style>

            <div className="ps-wrap">
                {/* الترويسة */}
                <table className="ps-table" style={{ marginBottom: 10 }}>
                    <tbody>
                        <tr>
                            <td style={{ width: '30%', textAlign: 'center', fontWeight: 700, lineHeight: 1.6 }}>
                                إدارة التوجيه التربوي
                                <br />
                                قسم التربية الإسلامية
                            </td>
                            <td style={{ width: '40%', textAlign: 'center', verticalAlign: 'middle' }}>
                                <span style={{ fontSize: 16, fontWeight: 800, color: MAROON }}>استمارة الإشراف على أداء المنسق</span>
                            </td>
                            <td style={{ width: '30%', textAlign: 'center', fontWeight: 700, lineHeight: 1.5, fontSize: 11 }}>
                                وزارة التربية والتعليم والتعليم العالي
                                <br />
                                Ministry of Education and Higher Education
                                <br />
                                دولة قطر
                            </td>
                        </tr>
                    </tbody>
                </table>

                {/* المعلومات الأساسية */}
                <div className="ps-bar" style={{ marginBottom: -1 }}>المعلومات الأساسية</div>
                <table className="ps-table" style={{ marginBottom: 12 }}>
                    <tbody>
                        {infoRows.map(([l1, v1, l2, v2]) => (
                            <tr key={l1}>
                                <td className="ps-lbl">{l1}</td>
                                <td className="ps-val">
                                    <b>{v1 ?? '—'}</b>
                                </td>
                                <td className="ps-lbl">{l2}</td>
                                <td className="ps-val">
                                    <b>{v2 ?? '—'}</b>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* مجالات الأداء */}
                <table className="ps-table">
                    <thead className="ps-head">
                        <tr>
                            <th style={{ width: '4%' }}>م</th>
                            <th style={{ width: '16%' }}>المجال</th>
                            <th style={{ width: '36%' }}>مؤشرات الأداء</th>
                            <th style={{ width: '44%' }}>الملاحظات والتوصيات</th>
                        </tr>
                    </thead>
                    <tbody>
                        {scores.map((s, i) => (
                            <tr key={s.id}>
                                <td style={{ textAlign: 'center', fontWeight: 700 }} className="tnum">
                                    {i + 1}
                                </td>
                                <td style={{ textAlign: 'center', fontWeight: 700 }}>
                                    {s.criterion_text}
                                    {s.score != null && (
                                        <span style={{ display: 'block', marginTop: 4, fontSize: 10, fontWeight: 400, color: '#6b7280' }} className="tnum">
                                            الدرجة: {s.score} / {s.max_score}
                                        </span>
                                    )}
                                </td>
                                <td style={{ lineHeight: 1.8 }}>{s.indicators ?? '—'}</td>
                                <td style={{ lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                                    {s.note ?? ''}
                                    {s.attachment_name && (
                                        <span style={{ color: '#6b7280', fontSize: 11 }}> (مرفق: {s.attachment_name})</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* ملاحظات عامة (إن وُجدت) */}
                {review.notes && (
                    <table className="ps-table" style={{ marginTop: 12 }}>
                        <tbody>
                            <tr>
                                <td className="ps-lbl" style={{ width: '14%' }}>
                                    ملاحظات عامة
                                </td>
                                <td style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{review.notes}</td>
                            </tr>
                        </tbody>
                    </table>
                )}

                {/* التواقيع */}
                <table className="ps-table" style={{ marginTop: 24 }}>
                    <tbody>
                        <tr className="ps-head">
                            <th style={{ width: '50%' }}>توقيع المنسّق</th>
                            <th style={{ width: '50%' }}>توقيع الموجّه التربوي</th>
                        </tr>
                        <tr>
                            <td style={{ height: 60 }}></td>
                            <td style={{ height: 60 }}></td>
                        </tr>
                    </tbody>
                </table>

                {/* تذييل النموذج */}
                <table className="ps-table" style={{ marginTop: 16 }}>
                    <tbody>
                        <tr style={{ fontSize: 10.5 }}>
                            <td style={{ textAlign: 'center' }}>
                                رمز النموذج: <b>ES-ESI-P10-F3</b>
                            </td>
                            <td style={{ textAlign: 'center' }}>رقم الإصدار: 1</td>
                            <td style={{ textAlign: 'center' }}>تاريخ الإصدار: 21-05-2024</td>
                            <td style={{ textAlign: 'center' }}>التصنيف: داخلي</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <button
                className="no-print"
                onClick={() => window.print()}
                style={{
                    position: 'fixed',
                    top: 16,
                    left: 16,
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: '1px solid #d1d5db',
                    background: '#fff',
                    cursor: 'pointer',
                }}
            >
                طباعة
            </button>
        </div>
    );
}
