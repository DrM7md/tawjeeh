import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
    type ColumnDef,
    type SortingState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from '@tanstack/react-table';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useState } from 'react';

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
}

/** جدول تفاعلي موحّد: بحث لحظي + فرز + ترقيم صفحات. مبني على TanStack Table. */
export function DataTable<TData, TValue>({
    columns,
    data,
    searchPlaceholder = 'بحث...',
    searchable = true,
    emptyMessage = 'لا توجد بيانات',
    pageSize = 10,
    toolbar,
}: DataTableProps<TData, TValue>) {
    const [sorting, setSorting] = useState<SortingState>([]);
    const [globalFilter, setGlobalFilter] = useState('');

    const table = useReactTable({
        data,
        columns,
        state: { sorting, globalFilter },
        onSortingChange: setSorting,
        onGlobalFilterChange: setGlobalFilter,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: { pagination: { pageSize } },
    });

    return (
        <div className="space-y-4">
            {(searchable || toolbar) && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                    {searchable && (
                        <div className="relative w-full max-w-xs">
                            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2" />
                            <Input
                                value={globalFilter ?? ''}
                                onChange={(e) => setGlobalFilter(e.target.value)}
                                placeholder={searchPlaceholder}
                                className="pr-9"
                            />
                        </div>
                    )}
                    {toolbar}
                </div>
            )}

            <div className="bg-card overflow-hidden rounded-2xl border border-border/60">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((hg) => (
                            <TableRow key={hg.id} className="hover:bg-transparent">
                                {hg.headers.map((header) => (
                                    <TableHead key={header.id}>
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(header.column.columnDef.header, header.getContext())}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow key={row.id}>
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="text-muted-foreground h-28 text-center">
                                    {emptyMessage}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {table.getPageCount() > 1 && (
                <div className="flex items-center justify-between gap-2">
                    <p className="text-muted-foreground text-xs">
                        صفحة {table.getState().pagination.pageIndex + 1} من {table.getPageCount()} — {table.getFilteredRowModel().rows.length} سجل
                    </p>
                    <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                            <ChevronRight className="size-4" />
                        </Button>
                        <Button variant="outline" size="icon" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                            <ChevronLeft className="size-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
