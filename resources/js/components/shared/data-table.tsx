import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import {
    type ColumnDef,
    type SortingState,
    type VisibilityState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from '@tanstack/react-table';
import { ChevronLeft, ChevronRight, LayoutGrid, Rows3, Search, Settings2, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

/** فلتر مُجزّأ: قائمة منسدلة تُصفّي الصفوف وفق قيمة مشتقّة من كل صف. */
export interface DataTableFilter<TData> {
    /** مُعرّف فريد للفلتر */
    id: string;
    /** التسمية الظاهرة كعنوان افتراضي */
    label: string;
    /** الخيارات المتاحة */
    options: { value: string; label: string }[];
    /** استخراج القيمة المُقارَنة من الصف. عند إرجاع مصفوفة يُطابَق إن احتوت القيمة (مفيد للعلاقات المتعددة). */
    getValue: (row: TData) => string | number | string[] | null | undefined;
    /** شكل العرض: 'select' قائمة منسدلة (الافتراضي)، 'tabs' أزرار تبويب (للخيارات القليلة)، 'search' قائمة منسدلة قابلة للبحث (للخيارات الكثيرة). */
    variant?: 'select' | 'tabs' | 'search';
}

const ALL = '__all__';

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[];
    data: TData[];
    searchPlaceholder?: string;
    /** أظهِر صندوق البحث اللحظي العام */
    searchable?: boolean;
    /** رسالة عند عدم وجود بيانات */
    emptyMessage?: string;
    pageSize?: number;
    toolbar?: React.ReactNode;
    /** فلاتر منسدلة تُصفّي البيانات قبل عرضها */
    filters?: DataTableFilter<TData>[];
    /** عارض البطاقة لصف واحد — وجوده يُفعّل زر التبديل بين الجدول والبطاقات */
    renderCard?: (row: TData) => React.ReactNode;
    /** مفتاح حفظ تفضيلات العرض في المتصفح (مطلوب لتفعيل الحفظ) */
    storageKey?: string;
    /** طريقة العرض الافتراضية */
    defaultView?: 'table' | 'cards';
}

type ViewMode = 'table' | 'cards';

/** تفضيلات عرض الجدول المحفوظة. */
interface TablePrefs {
    view: ViewMode;
    /** عدد البطاقات في الصف (1..4) */
    cols: number;
    /** معرّفات الأعمدة المخفية */
    hidden: string[];
    /** قيم الفلاتر المختارة (محفوظة كي تبقى عند الانتقال والرجوع) */
    filters: Record<string, string>;
}

const DEFAULT_PREFS: TablePrefs = { view: 'table', cols: 3, hidden: [], filters: {} };

/** فئات الشبكة لعدد البطاقات في الصف — ثابتة كي يلتقطها Tailwind. */
const COLS_CLASS: Record<number, string> = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
};

/** يحفظ تفضيلات العرض في localStorage ويستعيدها (آمن مع التصيير على الخادم). */
function usePersistedPrefs(storageKey: string | undefined, fallback: TablePrefs): [TablePrefs, (patch: Partial<TablePrefs>) => void] {
    const [prefs, setPrefs] = useState<TablePrefs>(fallback);

    useEffect(() => {
        if (!storageKey || globalThis.window === undefined) return;
        const saved = globalThis.localStorage.getItem(storageKey);
        if (!saved) return;
        try {
            const parsed = JSON.parse(saved);
            if (parsed && typeof parsed === 'object') {
                setPrefs((prev) => ({ ...prev, ...parsed }));
            }
        } catch {
            // قيمة قديمة محفوظة كنص ('table'/'cards') — رحّلها للشكل الجديد
            if (saved === 'table' || saved === 'cards') setPrefs((prev) => ({ ...prev, view: saved }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [storageKey]);

    const update = (patch: Partial<TablePrefs>) => {
        setPrefs((prev) => {
            const next = { ...prev, ...patch };
            if (storageKey && globalThis.window !== undefined) globalThis.localStorage.setItem(storageKey, JSON.stringify(next));
            return next;
        });
    };

    return [prefs, update];
}

/** جدول تفاعلي موحّد: بحث لحظي + فلاتر + فرز + ترقيم + تبديل عرض + تخصيص الأعمدة وعددها (محفوظ). مبني على TanStack Table. */
export function DataTable<TData, TValue>({
    columns,
    data,
    searchPlaceholder = 'بحث...',
    searchable = true,
    emptyMessage = 'لا توجد بيانات',
    pageSize = 10,
    toolbar,
    filters,
    renderCard,
    storageKey,
    defaultView = 'table',
}: DataTableProps<TData, TValue>) {
    const [sorting, setSorting] = useState<SortingState>([]);
    const [globalFilter, setGlobalFilter] = useState('');
    const [prefs, setPrefs] = usePersistedPrefs(storageKey, { ...DEFAULT_PREFS, view: defaultView });

    // قيم الفلاتر محفوظة ضمن تفضيلات الجدول كي تبقى عند الانتقال لصفحة أخرى والرجوع
    const filterValues = prefs.filters ?? {};
    const setFilterValue = (id: string, v: string) => setPrefs({ filters: { ...filterValues, [id]: v } });

    // العرض كبطاقات متاح فقط عند تمرير عارض بطاقة
    const view: ViewMode = renderCard ? prefs.view : 'table';
    const cols = prefs.cols;

    const columnVisibility = useMemo<VisibilityState>(() => {
        const v: VisibilityState = {};
        for (const id of prefs.hidden) v[id] = false;
        return v;
    }, [prefs.hidden]);

    // طبّق الفلاتر المنسدلة على البيانات قبل تمريرها للجدول
    const activeFilters = filters?.filter((f) => filterValues[f.id] && filterValues[f.id] !== ALL) ?? [];
    const filteredData = useMemo(() => {
        if (!activeFilters.length) return data;
        return data.filter((row) =>
            activeFilters.every((f) => {
                const v = f.getValue(row);
                return Array.isArray(v) ? v.map(String).includes(filterValues[f.id]) : String(v ?? '') === filterValues[f.id];
            }),
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data, filters, filterValues]);

    const table = useReactTable({
        data: filteredData,
        columns,
        state: { sorting, globalFilter, columnVisibility },
        onSortingChange: setSorting,
        onGlobalFilterChange: setGlobalFilter,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: { pagination: { pageSize } },
    });

    const rows = table.getRowModel().rows;
    const resultCount = table.getFilteredRowModel().rows.length;
    const hasActiveFilters = activeFilters.length > 0 || globalFilter.length > 0;

    // الأعمدة القابلة للإخفاء: ذات عنوان نصّي (نستثني عمود الإجراءات والعناوين المعقّدة)
    const hideableColumns = table.getAllLeafColumns().filter((c) => typeof c.columnDef.header === 'string' && c.columnDef.header !== '');
    const canCustomize = view === 'cards' || hideableColumns.length > 0;

    const toggleColumn = (id: string) => {
        setPrefs({ hidden: prefs.hidden.includes(id) ? prefs.hidden.filter((x) => x !== id) : [...prefs.hidden, id] });
    };

    const resetAll = () => {
        setGlobalFilter('');
        setPrefs({ filters: {} });
    };

    const showToolbar = searchable || toolbar || (filters && filters.length > 0) || !!renderCard || canCustomize;

    const renderFilter = (f: DataTableFilter<TData>) => {
        const current = filterValues[f.id] ?? ALL;

        if (f.variant === 'search') {
            return (
                <Combobox
                    key={f.id}
                    className="w-full sm:w-56"
                    placeholder={`${f.label}: الكل`}
                    emptyText="لا نتائج"
                    value={current}
                    onChange={(v) => setFilterValue(f.id, v || ALL)}
                    items={[{ value: ALL, label: `${f.label}: الكل` }, ...f.options]}
                />
            );
        }

        if (f.variant === 'tabs') {
            return (
                <div key={f.id} className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm whitespace-nowrap">{f.label}:</span>
                    <ToggleGroup
                        type="single"
                        size="sm"
                        dir="rtl"
                        value={current}
                        onValueChange={(v) => setFilterValue(f.id, v || ALL)}
                        className="bg-card border-border/60 gap-0.5 rounded-xl border p-0.5 shadow-xs"
                    >
                        <ToggleGroupItem value={ALL} className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground rounded-lg px-3">
                            الكل
                        </ToggleGroupItem>
                        {f.options.map((o) => (
                            <ToggleGroupItem
                                key={o.value}
                                value={o.value}
                                className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground rounded-lg px-3"
                            >
                                {o.label}
                            </ToggleGroupItem>
                        ))}
                    </ToggleGroup>
                </div>
            );
        }

        return (
            <Select key={f.id} value={current} onValueChange={(v) => setFilterValue(f.id, v)}>
                <SelectTrigger className="bg-card border-border/60 h-10 w-auto min-w-[9rem] gap-2 rounded-xl shadow-xs">
                    <SlidersHorizontal className="text-muted-foreground size-3.5" />
                    <SelectValue placeholder={f.label} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={ALL}>{f.label}: الكل</SelectItem>
                    {f.options.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                            {o.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        );
    };

    const cardsView = rows.length ? (
        <div className={cn('grid gap-3', COLS_CLASS[cols] ?? COLS_CLASS[3])}>
            {rows.map((row) => (
                <div key={row.id}>{renderCard?.(row.original)}</div>
            ))}
        </div>
    ) : (
        <div className="bg-card text-muted-foreground border-border/60 rounded-2xl border p-10 text-center">{emptyMessage}</div>
    );

    return (
        <div className="space-y-4">
            {showToolbar && (
                <div className="flex flex-wrap items-center gap-3">
                    {searchable && (
                        <div className="relative w-full sm:max-w-xs">
                            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2" />
                            <Input
                                value={globalFilter ?? ''}
                                onChange={(e) => setGlobalFilter(e.target.value)}
                                placeholder={searchPlaceholder}
                                className="bg-card border-border/60 rounded-xl px-9 shadow-xs transition-colors"
                                aria-label={searchPlaceholder}
                            />
                            {globalFilter && (
                                <button
                                    type="button"
                                    onClick={() => setGlobalFilter('')}
                                    aria-label="مسح البحث"
                                    className="text-muted-foreground hover:bg-muted hover:text-foreground absolute top-1/2 left-2 -translate-y-1/2 rounded-md p-1 transition-colors"
                                >
                                    <X className="size-3.5" />
                                </button>
                            )}
                        </div>
                    )}

                    {filters?.map(renderFilter)}

                    {hasActiveFilters && (
                        <Button variant="ghost" size="sm" onClick={resetAll} className="text-muted-foreground gap-1">
                            <X className="size-4" /> مسح
                        </Button>
                    )}

                    <div className="ms-auto flex items-center gap-2">
                        {toolbar}

                        {canCustomize && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="bg-card border-border/60 rounded-xl shadow-xs"
                                        aria-label="إعدادات العرض"
                                    >
                                        <Settings2 className="size-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" sideOffset={10} collisionPadding={16} className="w-60 rounded-xl shadow-lg">
                                    {view === 'cards' ? (
                                        <>
                                            <DropdownMenuLabel>عدد البطاقات في الصف</DropdownMenuLabel>
                                            <div className="flex gap-1.5 p-2">
                                                {[1, 2, 3, 4].map((n) => (
                                                    <button
                                                        key={n}
                                                        type="button"
                                                        onClick={() => setPrefs({ cols: n })}
                                                        aria-pressed={cols === n}
                                                        className={cn(
                                                            'flex h-9 flex-1 items-center justify-center rounded-lg border text-sm font-medium transition',
                                                            cols === n
                                                                ? 'border-primary bg-primary/10 text-primary'
                                                                : 'border-border text-muted-foreground hover:bg-muted',
                                                        )}
                                                    >
                                                        {n}
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <DropdownMenuLabel>الأعمدة الظاهرة</DropdownMenuLabel>
                                            <DropdownMenuSeparator />
                                            {hideableColumns.map((c) => {
                                                const last =
                                                    c.getIsVisible() &&
                                                    table
                                                        .getVisibleLeafColumns()
                                                        .filter((x) => typeof x.columnDef.header === 'string' && x.columnDef.header !== '').length ===
                                                        1;
                                                return (
                                                    <DropdownMenuCheckboxItem
                                                        key={c.id}
                                                        checked={c.getIsVisible()}
                                                        disabled={last}
                                                        onCheckedChange={() => toggleColumn(c.id)}
                                                        onSelect={(e) => e.preventDefault()}
                                                    >
                                                        {c.columnDef.header as string}
                                                    </DropdownMenuCheckboxItem>
                                                );
                                            })}
                                        </>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}

                        {renderCard && (
                            <div className="bg-muted/60 flex items-center gap-0.5 rounded-xl p-0.5">
                                <button
                                    type="button"
                                    onClick={() => setPrefs({ view: 'table' })}
                                    aria-label="عرض كجدول"
                                    aria-pressed={view === 'table'}
                                    className={cn(
                                        'rounded-lg p-1.5 transition-colors',
                                        view === 'table' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
                                    )}
                                >
                                    <Rows3 className="size-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPrefs({ view: 'cards' })}
                                    aria-label="عرض كبطاقات"
                                    aria-pressed={view === 'cards'}
                                    className={cn(
                                        'rounded-lg p-1.5 transition-colors',
                                        view === 'cards' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
                                    )}
                                >
                                    <LayoutGrid className="size-4" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {renderCard && view === 'cards' ? (
                cardsView
            ) : (
                <div className="bg-card border-border/60 overflow-hidden rounded-2xl border">
                    <Table>
                        <TableHeader>
                            {table.getHeaderGroups().map((hg) => (
                                <TableRow key={hg.id} className="hover:bg-transparent">
                                    {hg.headers.map((header) => (
                                        <TableHead key={header.id}>
                                            {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody>
                            {rows.length ? (
                                rows.map((row) => (
                                    <TableRow key={row.id}>
                                        {row.getVisibleCells().map((cell) => (
                                            <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={table.getVisibleLeafColumns().length} className="text-muted-foreground h-28 text-center">
                                        {emptyMessage}
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            )}

            {(table.getPageCount() > 1 || hasActiveFilters) && (
                <div className="flex items-center justify-between gap-2">
                    <p className="text-muted-foreground text-xs">
                        {table.getPageCount() > 1
                            ? `صفحة ${table.getState().pagination.pageIndex + 1} من ${table.getPageCount()} — ${resultCount} سجل`
                            : `${resultCount} سجل`}
                    </p>
                    {table.getPageCount() > 1 && (
                        <div className="flex items-center gap-1">
                            <Button variant="outline" size="icon" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                                <ChevronRight className="size-4" />
                            </Button>
                            <Button variant="outline" size="icon" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                                <ChevronLeft className="size-4" />
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
