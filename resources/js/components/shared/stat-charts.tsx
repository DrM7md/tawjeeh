import { cn } from '@/lib/utils';
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    LabelList,
    Legend,
    PolarAngleAxis,
    PolarGrid,
    Pie,
    PieChart,
    Radar,
    RadarChart,
    RadialBar,
    RadialBarChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

/** لوحة ألوان موحّدة للرسوم — مستمدّة من هوية النظام (عنابي + ألوان داعمة متناسقة). */
export const PALETTE = ['#8D1B3D', '#3B82F6', '#FF9F0A', '#14b8a6', '#22C55E', '#A855F7', '#EC4899', '#64748B'];

export interface Datum {
    name: string;
    value: number;
}

/** يفتح اللون لإنشاء طرف فاتح للتدرّج. */
function lighten(hex: string, amount = 0.85) {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    const mix = (c: number) => Math.round(c + (255 - c) * amount);
    return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

/** تلميح مخصّص أنيق: بطاقة زجاجية + نقطة لون + أرقام لاتينية. */
function ChartTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-popover/95 min-w-[120px] rounded-xl border border-border/70 px-3 py-2 shadow-xl backdrop-blur-sm">
            {label && <p className="mb-1.5 text-xs font-bold">{label}</p>}
            <div className="space-y-1">
                {payload.map((p: any, i: number) => (
                    <div key={i} className="flex items-center justify-between gap-3 text-xs">
                        <span className="flex items-center gap-1.5">
                            <span className="size-2.5 rounded-full" style={{ background: p.color || p.fill }} />
                            <span className="text-muted-foreground">{p.name}</span>
                        </span>
                        <span className="tnum font-semibold">{Number(p.value).toLocaleString('en-US')}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

/** غلاف موحّد لكل رسم: شريط لون علوي + عنوان + تلميح + إطار. */
export function ChartCard({
    title,
    hint,
    accent = PALETTE[0],
    children,
    className,
    actions,
}: {
    title: string;
    hint?: string;
    accent?: string;
    children: React.ReactNode;
    className?: string;
    actions?: React.ReactNode;
}) {
    return (
        <div className={cn('group bg-card relative flex flex-col overflow-hidden rounded-2xl border border-border/60 p-5 shadow-sm transition-shadow hover:shadow-md', className)}>
            <span className="absolute inset-x-0 top-0 h-1 opacity-80" style={{ background: `linear-gradient(90deg, ${accent}, ${lighten(accent, 0.4)})` }} />
            <div className="mb-4 flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                    <h2 className="text-base font-semibold">{title}</h2>
                    {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
                </div>
                {actions}
            </div>
            <div className="flex-1">{children}</div>
        </div>
    );
}

function Empty({ height }: { height: number }) {
    return (
        <div className="text-muted-foreground/70 flex flex-col items-center justify-center gap-2 text-sm" style={{ height }}>
            <span className="bg-muted flex size-10 items-center justify-center rounded-full text-lg">∅</span>
            لا توجد بيانات لعرضها
        </div>
    );
}

/** حبّة (pill) للأرقام: خلفية داكنة ونص فاتح تبرز فوق أي لون بدل تداخل النص مع العمود. */
function makePill(horizontal: boolean, unit: string) {
    return function PillLabel(props: any) {
        const { x, y, width, height, value } = props;
        if (value === null || value === undefined) return null;
        const text = `${Number(value).toLocaleString('en-US')}${unit}`;
        const h = 19;
        const w = Math.max(24, text.length * 7.2 + 12);
        const cx = horizontal ? x + width + 6 + w / 2 : x + width / 2;
        const cy = horizontal ? y + height / 2 : y - 6 - h / 2;
        return (
            <g>
                <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx={9.5} style={{ fill: 'var(--foreground)' }} opacity={0.92} />
                <text x={cx} y={cy + 0.5} textAnchor="middle" dominantBaseline="central" style={{ fill: 'var(--card)', fontSize: 11, fontWeight: 700 }}>
                    {text}
                </text>
            </g>
        );
    };
}

/** رسم أعمدة بتدرّج لوني + زوايا دائرية + قيم داخل حبّات بارزة. */
export function BarCard({
    title,
    hint,
    data,
    color = PALETTE[0],
    horizontal = false,
    height = 300,
    showValues = true,
    unit = '',
    className,
}: {
    title: string;
    hint?: string;
    data: Datum[];
    color?: string;
    horizontal?: boolean;
    height?: number;
    showValues?: boolean;
    unit?: string;
    className?: string;
}) {
    const gid = `bar-${title.replace(/[^a-zA-Z0-9]/g, '')}`;
    const pill = makePill(horizontal, unit);

    return (
        <ChartCard title={title} hint={hint} accent={color} className={className}>
            {data.length === 0 ? (
                <Empty height={height} />
            ) : (
                <ResponsiveContainer width="100%" height={height}>
                    {horizontal ? (
                        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 36 }} barCategoryGap={data.length > 8 ? '14%' : '28%'}>
                            <defs>
                                <linearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
                                    <stop offset="0%" stopColor={lighten(color, 0.3)} />
                                    <stop offset="100%" stopColor={color} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="currentColor" className="text-border/40" />
                            <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} axisLine={false} tickLine={false} />
                            <YAxis type="category" dataKey="name" width={132} tick={{ fontSize: 11 }} interval={0} axisLine={false} tickLine={false} />
                            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'currentColor', className: 'text-muted/40' } as any} />
                            <Bar dataKey="value" fill={`url(#${gid})`} radius={[0, 8, 8, 0]} maxBarSize={30} animationDuration={900}>
                                {showValues && <LabelList dataKey="value" content={pill} />}
                            </Bar>
                        </BarChart>
                    ) : (
                        <BarChart data={data} margin={{ top: 20 }}>
                            <defs>
                                <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={color} />
                                    <stop offset="100%" stopColor={lighten(color, 0.55)} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="currentColor" className="text-border/40" />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} axisLine={false} tickLine={false} angle={data.length > 6 ? -20 : 0} textAnchor={data.length > 6 ? 'end' : 'middle'} height={data.length > 6 ? 56 : 30} />
                            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} axisLine={false} tickLine={false} />
                            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'currentColor', className: 'text-muted/40' } as any} />
                            <Bar dataKey="value" fill={`url(#${gid})`} radius={[8, 8, 0, 0]} maxBarSize={52} animationDuration={900}>
                                {showValues && <LabelList dataKey="value" content={pill} />}
                            </Bar>
                        </BarChart>
                    )}
                </ResponsiveContainer>
            )}
        </ChartCard>
    );
}

/** دائرة مفرّغة (Donut) مع رقم إجمالي في المنتصف. */
export function PieCard({
    title,
    hint,
    data,
    colors = PALETTE,
    height = 300,
    centerLabel,
    className,
}: {
    title: string;
    hint?: string;
    data: Datum[];
    colors?: string[];
    height?: number;
    centerLabel?: string;
    className?: string;
}) {
    const total = data.reduce((s, d) => s + d.value, 0);
    const hasData = total > 0;

    return (
        <ChartCard title={title} hint={hint} accent={colors[0]} className={className}>
            {!hasData ? (
                <Empty height={height} />
            ) : (
                <div className="relative" style={{ height }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <defs>
                                {colors.map((c, i) => (
                                    <linearGradient key={i} id={`pie-${title.replace(/[^a-zA-Z0-9]/g, '')}-${i}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={c} />
                                        <stop offset="100%" stopColor={lighten(c, 0.3)} />
                                    </linearGradient>
                                ))}
                            </defs>
                            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={62} outerRadius={98} paddingAngle={data.length > 1 ? 3 : 0} stroke="var(--card)" strokeWidth={3} cornerRadius={6} animationDuration={900}>
                                {data.map((_, i) => (
                                    <Cell key={i} fill={`url(#pie-${title.replace(/[^a-zA-Z0-9]/g, '')}-${i % colors.length})`} />
                                ))}
                            </Pie>
                            <Tooltip content={<ChartTooltip />} />
                            <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center justify-center" style={{ height: height - 36 }}>
                        <span className="tnum text-3xl font-bold tracking-tight">{total.toLocaleString('en-US')}</span>
                        <span className="text-muted-foreground text-xs">{centerLabel ?? 'الإجمالي'}</span>
                    </div>
                </div>
            )}
        </ChartCard>
    );
}

/** رسم اتجاه زمني — مساحة متدرّجة بمنحنى ناعم ونقاط تفاعلية. */
export function TrendCard({
    title,
    hint,
    data,
    color = PALETTE[0],
    height = 300,
    className,
}: {
    title: string;
    hint?: string;
    data: Datum[];
    color?: string;
    height?: number;
    className?: string;
}) {
    const gid = `grad-${title.replace(/[^a-zA-Z0-9]/g, '')}`;

    return (
        <ChartCard title={title} hint={hint} accent={color} className={className}>
            {data.length === 0 ? (
                <Empty height={height} />
            ) : (
                <ResponsiveContainer width="100%" height={height}>
                    <AreaChart data={data} margin={{ top: 12, right: 12 }}>
                        <defs>
                            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={color} stopOpacity={0.45} />
                                <stop offset="95%" stopColor={color} stopOpacity={0.02} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="currentColor" className="text-border/40" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} interval="preserveStartEnd" axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={32} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltip />} cursor={{ stroke: color, strokeOpacity: 0.35, strokeWidth: 2 }} />
                        <Area type="monotone" dataKey="value" name="العدد" stroke={color} strokeWidth={2.5} fill={`url(#${gid})`} dot={{ r: 3, fill: color, strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 2, stroke: 'var(--card)' }} animationDuration={1000} />
                    </AreaChart>
                </ResponsiveContainer>
            )}
        </ChartCard>
    );
}

/** عدّاد دائري واحد بنسبة مئوية ورقم في المنتصف. */
function Gauge({ pct, color, label, sub, size = 150 }: { pct: number; color: string; label: string; sub?: string; size?: number }) {
    const clamped = Math.max(0, Math.min(100, pct));
    return (
        <div className="flex flex-col items-center gap-1">
            <div className="relative" style={{ width: size, height: size }}>
                <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart innerRadius="72%" outerRadius="100%" data={[{ value: clamped, fill: color }]} startAngle={90} endAngle={-270}>
                        <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                        <RadialBar background={{ fill: 'var(--muted)' } as any} dataKey="value" cornerRadius={30} angleAxisId={0} animationDuration={1000} />
                    </RadialBarChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="tnum text-2xl font-bold tracking-tight" style={{ color }}>
                        {Math.round(clamped)}%
                    </span>
                    {sub && <span className="text-muted-foreground text-[11px]">{sub}</span>}
                </div>
            </div>
            <span className="text-sm font-medium">{label}</span>
        </div>
    );
}

/** بطاقة عدّادات دائرية (واحد أو أكثر) جنبًا إلى جنب. */
export function GaugeCard({
    title,
    hint,
    items,
    className,
}: {
    title: string;
    hint?: string;
    items: { pct: number; color?: string; label: string; sub?: string }[];
    className?: string;
}) {
    return (
        <ChartCard title={title} hint={hint} accent={items[0]?.color ?? PALETTE[0]} className={className}>
            <div className="flex flex-wrap items-center justify-around gap-4 py-2">
                {items.map((it, i) => (
                    <Gauge key={i} pct={it.pct} color={it.color ?? PALETTE[i % PALETTE.length]} label={it.label} sub={it.sub} />
                ))}
            </div>
        </ChartCard>
    );
}

/** رسم رادار — لمقارنة قيمة واحدة عبر عدّة فئات (مثل متوسط الدرجة لكل مادة). */
export function RadarCard({
    title,
    hint,
    data,
    color = PALETTE[0],
    height = 320,
    seriesName = 'القيمة',
    className,
}: {
    title: string;
    hint?: string;
    data: Datum[];
    color?: string;
    height?: number;
    seriesName?: string;
    className?: string;
}) {
    const gid = `radar-${title.replace(/[^a-zA-Z0-9]/g, '')}`;

    return (
        <ChartCard title={title} hint={hint} accent={color} className={className}>
            {data.length < 3 ? (
                <Empty height={height} />
            ) : (
                <ResponsiveContainer width="100%" height={height}>
                    <RadarChart data={data} outerRadius="72%">
                        <defs>
                            <radialGradient id={gid}>
                                <stop offset="0%" stopColor={color} stopOpacity={0.05} />
                                <stop offset="100%" stopColor={color} stopOpacity={0.4} />
                            </radialGradient>
                        </defs>
                        <PolarGrid stroke="currentColor" className="text-border/60" />
                        <PolarAngleAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <Radar name={seriesName} dataKey="value" stroke={color} strokeWidth={2} fill={`url(#${gid})`} fillOpacity={1} dot={{ r: 3, fill: color }} animationDuration={1000} />
                        <Tooltip content={<ChartTooltip />} />
                    </RadarChart>
                </ResponsiveContainer>
            )}
        </ChartCard>
    );
}
