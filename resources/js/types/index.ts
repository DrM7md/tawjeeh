import { LucideIcon } from 'lucide-react';

export interface Auth {
    user: User;
    permissions?: string[];
    is_super?: boolean;
}

export interface BreadcrumbItem {
    title: string;
    href: string;
}

/* ===================== أنواع النطاق (Domain) ===================== */

export interface NavItem {
    title: string;
    url: string;
    icon?: LucideIcon | null;
    isActive?: boolean;
    permission?: string;
}

export interface Role {
    id: number;
    name: string;
    display_name: string;
    level: number;
    permissions?: string[];
    is_system?: boolean;
    users_count?: number;
}

export interface Department {
    id: number;
    name: string;
    code: string | null;
    head_user_id: number | null;
    head?: { id: number; name: string } | null;
    color: string | null;
    is_active: boolean;
    users_count?: number;
}

export interface Stage {
    id: number;
    name: string;
    code: string;
    sort_order: number;
}

export interface TeacherClassification {
    id: number;
    name: string;
    code: string;
    required_visits: number;
    color: string | null;
}

export interface School {
    id: number;
    name: string;
    code: string | null;
    stage_id: number | null;
    stage?: { id: number; name: string } | null;
    gender: 'boys' | 'girls' | 'mixed' | null;
    zone: string | null;
    address: string | null;
    is_active: boolean;
}

export interface DomainUser {
    id: number;
    name: string;
    email: string;
    phone: string | null;
    department_id: number | null;
    department?: { id: number; name: string } | null;
    roles?: Role[];
    is_active: boolean;
}

export type AcademicYearStatus = 'active' | 'closed' | 'archived';
export type SemesterStatus = 'not_started' | 'active' | 'ended' | 'closed';

export interface Semester {
    id: number;
    academic_year_id: number;
    name: string;
    start_date?: string | null;
    end_date?: string | null;
    is_active: boolean;
    status: SemesterStatus;
}

export interface AcademicYear {
    id: number;
    name: string;
    start_date?: string | null;
    end_date?: string | null;
    is_active: boolean;
    status: AcademicYearStatus;
    semesters?: Semester[];
    semesters_count?: number;
}

export interface AcademicContext {
    years: { id: number; name: string; is_active: boolean; status: AcademicYearStatus }[];
    semesters: { id: number; name: string; is_active: boolean; status: SemesterStatus; academic_year_id: number }[];
    selectedYearId: number | null;
    selectedSemesterId: number | null;
    activeYearId: number | null;
    activeSemesterId: number | null;
    isEditable: boolean;
}

export interface NavGroup {
    title: string;
    items: NavItem[];
}

export interface SharedData {
    name: string;
    quote: { message: string; author: string };
    auth: Auth;
    [key: string]: unknown;
}

export interface User {
    id: number;
    name: string;
    email: string;
    avatar?: string;
    email_verified_at: string | null;
    created_at: string;
    updated_at: string;
    [key: string]: unknown; // This allows for additional properties...
}
