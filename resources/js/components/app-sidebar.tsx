import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { type NavItem } from '@/types';
import { Link } from '@inertiajs/react';
import { Award, Building2, CalendarRange, ClipboardCheck, Database, FileSpreadsheet, History, LayoutGrid, Network, School, Settings2, ShieldCheck, Users } from 'lucide-react';
import AppLogo from './app-logo';

const mainNavItems: NavItem[] = [
    { title: 'لوحة التحكم', url: '/dashboard', icon: LayoutGrid },
    { title: 'الأعوام الدراسية', url: '/academic', icon: CalendarRange, permission: 'academic.view' },
    { title: 'توزيع المدارس', url: '/distribution', icon: Network, permission: 'distribution.view' },
    { title: 'استيراد المدارس', url: '/import', icon: FileSpreadsheet, permission: 'import.view' },
    { title: 'الزيارات والمتابعة', url: '/visits', icon: ClipboardCheck, permission: 'visits.view.own' },
    { title: 'تحكيم الاختبارات', url: '/reviews', icon: Award, permission: 'reviews.view.own' },
];

// الهيكل التنظيمي (Phase 1)
const organizationNavItems: NavItem[] = [
    { title: 'الأقسام', url: '/departments', icon: Building2, permission: 'departments.view' },
    { title: 'المدارس', url: '/schools', icon: School, permission: 'schools.view' },
    { title: 'المستخدمون', url: '/users', icon: Users, permission: 'users.view' },
    { title: 'الأدوار والصلاحيات', url: '/roles', icon: ShieldCheck, permission: 'roles.view' },
    { title: 'إعدادات الهيكل', url: '/organization-settings', icon: Settings2, permission: 'settings.manage' },
];

// النظام (Phase 8)
const systemNavItems: NavItem[] = [
    { title: 'سجل النشاط', url: '/audit', icon: History, permission: 'audit.view' },
    { title: 'النسخ الاحتياطي', url: '/backups', icon: Database, permission: 'backup.manage' },
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
                <NavMain items={systemNavItems} label="النظام" />
            </SidebarContent>

            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
