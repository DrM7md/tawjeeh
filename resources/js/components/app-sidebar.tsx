import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { type NavItem } from '@/types';
import { Link } from '@inertiajs/react';
import { Award, Building2, CalendarRange, ClipboardCheck, FileSpreadsheet, LayoutGrid, Network, School, Settings2, ShieldCheck, Users } from 'lucide-react';
import AppLogo from './app-logo';

const mainNavItems: NavItem[] = [
    { title: 'لوحة التحكم', url: '/dashboard', icon: LayoutGrid },
    { title: 'الأعوام الدراسية', url: '/academic', icon: CalendarRange, permission: 'academic.view' },
    { title: 'توزيع المدارس', url: '/distribution', icon: Network, permission: 'distribution.view' },
    { title: 'استيراد المدارس', url: '/import', icon: FileSpreadsheet, permission: 'import.view' },
    { title: 'الزيارات والمتابعة', url: '/visits', icon: ClipboardCheck, permission: 'visits.view.own' },
    { title: 'تحكيم الاختبارات', url: '/reviews', icon: Award, permission: 'reviews.view.own' },
];

// الهيكل التنظيمي
const organizationNavItems: NavItem[] = [
    { title: 'الأقسام', url: '/departments', icon: Building2, permission: 'departments.view' },
    { title: 'المدارس', url: '/schools', icon: School, permission: 'schools.view' },
    { title: 'المستخدمون', url: '/users', icon: Users, permission: 'users.view' },
    { title: 'الأدوار والصلاحيات', url: '/roles', icon: ShieldCheck, permission: 'roles.view' },
];

// أخرى — الإعدادات تجمع (إعدادات الهيكل/الأدوار/سجل النشاط/النسخ الاحتياطي + الحساب)
const otherNavItems: NavItem[] = [
    { title: 'الإعدادات', url: '/settings', icon: Settings2 },
];

export function AppSidebar() {
    return (
        <Sidebar side="right" collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href="/dashboard" prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={mainNavItems} label="الرئيسية" />
                <NavMain items={organizationNavItems} label="الهيكل التنظيمي" />
                <NavMain items={otherNavItems} label="أخرى" />
            </SidebarContent>

            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
