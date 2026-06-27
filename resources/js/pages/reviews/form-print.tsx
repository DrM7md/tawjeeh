import { examPeriodLabel } from '@/lib/exam-periods';
import { formatDate } from '@/lib/utils';
import { Head } from '@inertiajs/react';
import { useEffect } from 'react';

interface Indicator {
    id: number;
    label: string;
    weight: number;
}
interface Item {
    id: number;
    name: string;
    description: string | null;
    indicators: Indicator[];
}
interface Domain {
    id: number;
    name: string;
    kind: string;
    items: Item[];
}
interface ItemSelection {
    indicator_id: number | null;
    notes: string;
}
interface Review {
    id: number;
    exam_period: string | null;
    reviewed_at: string | null;
    school?: { name: string };
    department?: { name: string };
    stage?: { name: string };
    grade?: { name: string } | null;
    track?: { name: string } | null;
    preparer?: { name: string } | null;
    supervisor?: { name: string };
    academic_year?: { name: string } | null;
    form?: { criteria: Record<string, ItemSelection> | null } | null;
}
interface PageProps {
    review: Review;
    domains: Domain[];
}

export default function ReviewFormPrint({ review, domains }: Readonly<PageProps>) {
    useEffect(() => {
        const t = setTimeout(() => window.print(), 500);
        return () => clearTimeout(t);
    }, []);

    const criteria = review.form?.criteria ?? {};
    const gradeLabel = review.track?.name ? `${review.grade?.name ?? ''} — ${review.track.name}` : (review.grade?.name ?? '—');

    const info: [string, string | null][] = [
        ['المدرسة', review.school?.name ?? '—'],
        ['الاختبار', examPeriodLabel(review.exam_period)],
        ['التاريخ', formatDate(review.reviewed_at)],
        ['الصف', gradeLabel],
        ['المادة', review.department?.name ?? '—'],
        ['المرحلة', review.stage?.name ?? '—'],
    ];

    const signatures: [string, string][] = [
        ['المعلم (واضع الاختبار)', review.preparer?.name ?? ''],
        ['منسق المادة', ''],
        ['النائب الأكاديمي', ''],
        ['الموجه التربوي', review.supervisor?.name ?? ''],
    ];

    return (
        <div dir="rtl" style={{ padding: 24, color: '#111', background: '#fff', fontFamily: 'inherit' }}>
            <Head title={`استمارة تحكيم — ${review.school?.name ?? ''}`} />
            <style>{`
                @media print { .no-print { display: none } @page { margin: 12mm } }
                .rp { border-collapse: collapse; width: 100%; font-size: 12.5px }
                .rp th, .rp td { border: 1px solid #b9b9b9; padding: 5px 8px; vertical-align: middle }
                .rp th { background: #7b1c2e; color: #fff; text-align: center }
                .rp .domain { background: #f3f4f6; font-weight: 700; text-align: center; width: 90px }
                .rp .item { font-weight: 600; width: 220px }
                .rp .chk { width: 28px; text-align: center; font-weight: 800; color: #15803d }
                .rp .ind { width: 150px }
            `}</style>

            {/* الترويسة الرسمية */}
            <table className="rp" style={{ marginBottom: 10 }}>
                <tbody>
                    <tr>
                        <td style={{ width: '32%', textAlign: 'center', fontWeight: 700 }}>
                            إدارة التوجيه التربوي
                            <br />
                            قسم {review.department?.name ?? '—'}
                        </td>
                        <td style={{ width: '36%', textAlign: 'center', fontWeight: 800, fontSize: 15 }}>استمارة تحكيم واعتماد الاختبارات</td>
                        <td style={{ width: '32%', textAlign: 'center', fontWeight: 700 }}>
                            وزارة التربية والتعليم والتعليم العالي
                            <br />
                            دولة قطر
                        </td>
                    </tr>
                </tbody>
            </table>

            <p style={{ textAlign: 'center', margin: '0 0 10px', fontSize: 13 }}>
                العام الأكاديمي {review.academic_year?.name ?? '—'} م — الفصل الدراسي: {review.exam_period?.includes('second') ? 'الثاني' : 'الأول'}
            </p>

            {/* بيانات الاختبار */}
            <table className="rp" style={{ marginBottom: 12 }}>
                <tbody>
                    {[0, 1].map((row) => (
                        <tr key={row}>
                            {info.slice(row * 3, row * 3 + 3).map(([label, value]) => (
                                <td key={label} style={{ width: '33.33%' }}>
                                    <span style={{ color: '#6b7280', fontSize: 11 }}>{label}: </span>
                                    <b>{value ?? '—'}</b>
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* جدول التحكيم */}
            <table className="rp">
                <thead>
                    <tr>
                        <th>المجال</th>
                        <th>البنود</th>
                        <th colSpan={2}>المؤشرات</th>
                        <th>ملاحظات وتوصيات</th>
                    </tr>
                </thead>
                <tbody>
                    {domains.map((domain) => {
                        const domainRows = domain.items.reduce((a, it) => a + Math.max(1, it.indicators.length), 0);
                        const isApproval = domain.kind === 'approval';
                        let domainRendered = false;

                        return domain.items.map((item) => {
                            const sel = criteria[item.id];
                            const inds = item.indicators.length ? item.indicators : [];

                            return inds.map((ind, indIdx) => {
                                const cells = [];
                                // خلية المجال — مرّة واحدة لكل مجال (تُحذف لصفوف الاعتماد)
                                if (!domainRendered && !isApproval) {
                                    cells.push(
                                        <td key="domain" className="domain" rowSpan={domainRows}>
                                            {domain.name}
                                        </td>,
                                    );
                                    domainRendered = true;
                                }
                                // خلية البند — مرّة واحدة لكل بند (تمتدّ على مؤشراته)
                                if (indIdx === 0) {
                                    cells.push(
                                        <td key="item" className="item" rowSpan={inds.length} colSpan={isApproval ? 2 : 1}>
                                            {item.name}
                                            {item.description && (
                                                <div style={{ color: '#6b7280', fontSize: 11, fontWeight: 400 }}>{item.description}</div>
                                            )}
                                        </td>,
                                    );
                                }
                                cells.push(
                                    <td key="chk" className="chk">
                                        {sel?.indicator_id === ind.id ? '✓' : ''}
                                    </td>,
                                );
                                cells.push(
                                    <td key="ind" className="ind">
                                        {ind.label}
                                    </td>,
                                );
                                if (indIdx === 0) {
                                    cells.push(
                                        <td key="notes" rowSpan={inds.length} style={{ fontSize: 11.5, whiteSpace: 'pre-wrap' }}>
                                            {sel?.notes ?? ''}
                                        </td>,
                                    );
                                }
                                return <tr key={`${item.id}-${ind.id}`}>{cells}</tr>;
                            });
                        });
                    })}
                </tbody>
            </table>

            {/* التواقيع */}
            <table className="rp" style={{ marginTop: 16 }}>
                <tbody>
                    <tr>
                        <td style={{ width: 90, fontWeight: 700, background: '#f3f4f6' }}>الاسم</td>
                        {signatures.map(([role, name]) => (
                            <td key={role} style={{ textAlign: 'center' }}>
                                <div style={{ fontWeight: 700, fontSize: 11.5 }}>{role}</div>
                                <div style={{ marginTop: 4 }}>{name || '—'}</div>
                            </td>
                        ))}
                    </tr>
                    <tr>
                        <td style={{ fontWeight: 700, background: '#f3f4f6' }}>التوقيع</td>
                        {signatures.map(([role]) => (
                            <td key={role} style={{ height: 40 }} />
                        ))}
                    </tr>
                </tbody>
            </table>

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
