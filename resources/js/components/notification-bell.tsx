import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { type NotificationItem, type SharedData } from '@/types';
import { Link, router, usePage } from '@inertiajs/react';
import { Award, Bell, CalendarDays, CheckCheck, ClipboardCheck, Inbox, type LucideIcon } from 'lucide-react';
import { useEffect } from 'react';

/** أيقونة الإشعار حسب مفتاح النوع القادم من الخادم. */
const ICONS: Record<string, LucideIcon> = {
    visit: ClipboardCheck,
    review: Award,
    calendar: CalendarDays,
    bell: Bell,
};

/** وقت نسبي مختصر بالعربية. */
function relativeTime(iso: string): string {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return 'الآن';
    if (diff < 3600) return `قبل ${Math.floor(diff / 60)} دقيقة`;
    if (diff < 86400) return `قبل ${Math.floor(diff / 3600)} ساعة`;
    if (diff < 604800) return `قبل ${Math.floor(diff / 86400)} يوم`;
    return new Date(iso).toLocaleDateString('ar');
}

/** الفترة بين كل استعلام دوري عن الإشعارات (Polling). */
const POLL_INTERVAL = 30_000;

function NotificationRow({ item }: { item: NotificationItem }) {
    const Icon = ICONS[item.icon ?? 'bell'] ?? Bell;
    const unread = !item.read_at;

    const onClick = () => {
        if (unread) {
            router.post(`/notifications/${item.id}/read`, {}, { preserveScroll: true, preserveState: true, only: ['notifications'] });
        }
    };

    const content = (
        <div className="flex w-full items-start gap-3">
            <span className={cn('mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg', unread ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
                <Icon className="size-4.5" />
            </span>
            <div className="min-w-0 flex-1 space-y-0.5">
                <p className={cn('truncate text-sm', unread ? 'font-semibold' : 'font-medium')}>{item.title}</p>
                <p className="text-muted-foreground line-clamp-2 text-xs">{item.message}</p>
                <p className="text-muted-foreground/70 text-[11px]">{relativeTime(item.created_at)}</p>
            </div>
            {unread && <span className="bg-primary mt-1.5 size-2 shrink-0 rounded-full" aria-label="غير مقروء" />}
        </div>
    );

    return (
        <DropdownMenuItem asChild className="cursor-pointer p-2.5">
            {item.url ? (
                <Link href={item.url} onClick={onClick}>
                    {content}
                </Link>
            ) : (
                <button type="button" className="w-full text-right" onClick={onClick}>
                    {content}
                </button>
            )}
        </DropdownMenuItem>
    );
}

export function NotificationBell() {
    const { notifications } = usePage<SharedData>().props;
    const unread = notifications?.unread_count ?? 0;
    const items = notifications?.items ?? [];

    // استعلام دوري خفيف يُحدّث الإشعارات المشتركة فقط دون إعادة تحميل الصفحة.
    useEffect(() => {
        const id = setInterval(() => {
            router.reload({ only: ['notifications'] });
        }, POLL_INTERVAL);
        return () => clearInterval(id);
    }, []);

    const markAll = () => {
        router.post('/notifications/read-all', {}, { preserveScroll: true, preserveState: true, only: ['notifications'] });
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative size-9 rounded-full" aria-label="الإشعارات">
                    <Bell className="size-5" />
                    {unread > 0 && (
                        <Badge
                            variant="destructive"
                            className="absolute -top-1 -left-1 flex size-5 items-center justify-center rounded-full p-0 text-[10px] tabular-nums"
                        >
                            {unread > 9 ? '9+' : unread}
                        </Badge>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={10} collisionPadding={16} className="w-80 rounded-xl p-0 shadow-lg">
                <div className="flex items-center justify-between px-3 py-2">
                    <DropdownMenuLabel className="p-0 text-sm font-semibold">الإشعارات</DropdownMenuLabel>
                    {unread > 0 && (
                        <button type="button" onClick={markAll} className="text-primary flex items-center gap-1 text-xs hover:underline">
                            <CheckCheck className="size-3.5" />
                            تمييز الكل كمقروء
                        </button>
                    )}
                </div>
                <DropdownMenuSeparator className="my-0" />

                {items.length === 0 ? (
                    <div className="text-muted-foreground flex flex-col items-center gap-2 px-4 py-8 text-center text-sm">
                        <Inbox className="size-8 opacity-50" />
                        لا توجد إشعارات
                    </div>
                ) : (
                    <div className="max-h-96 overflow-y-auto py-1">
                        {items.map((item) => (
                            <NotificationRow key={item.id} item={item} />
                        ))}
                    </div>
                )}

                <DropdownMenuSeparator className="my-0" />
                <DropdownMenuItem asChild className="justify-center text-sm">
                    <Link href="/notifications">عرض كل الإشعارات</Link>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
