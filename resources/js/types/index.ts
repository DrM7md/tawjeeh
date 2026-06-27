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
    required_forms?: number;
    min_percent?: number | null;
    max_percent?: number | null;
    is_default_for_new?: boolean;
    color: string | null;
}

export interface ReviewCriterion {
    id: number;
    name: string;
    max_score: number;
    sort_order?: number;
}

/* ===================== تقييم ملفات المنسق ===================== */

export interface PortfolioReviewItem {
    id: number;
    portfolio_review_template_id: number;
    criterion_text: string;
    max_score: number;
    sort_order: number;
}

export interface PortfolioReviewTemplate {
    id: number;
    name: string;
    description: string | null;
    is_active: boolean;
    items?: PortfolioReviewItem[];
    items_count?: number;
    reviews_count?: number;
}

export interface PortfolioReviewScore {
    id: number;
    portfolio_review_item_id: number | null;
    criterion_text: string;
    max_score: number;
    score: number | null;
    note: string | null;
    attachment_path: string | null;
    attachment_name: string | null;
    sort_order: number;
}

export interface PortfolioReview {
    id: number;
    status: 'draft' | 'final';
    term: 'first' | 'second';
    teacher_id: number;
    reviewed_at: string | null;
    total_score: string | number | null;
    result: string | null;
    notes: string | null;
    coordinator?: { id: number; name: string; school?: { id: number; name: string } | null } | null;
    department?: { id: number; name: string } | null;
    supervisor?: { id: number; name: string } | null;
    template?: { id: number; name: string } | null;
    scores?: PortfolioReviewScore[];
    scores_count?: number;
}

export interface GradeTrack {
    id: number;
    grade_id?: number;
    name: string;
    sort_order?: number;
}

export interface Grade {
    id: number;
    stage_id: number | null;
    name: string;
    sort_order?: number;
    stage?: { id: number; name: string } | null;
    tracks?: GradeTrack[];
}

export interface School {
    id: number;
    name: string;
    code: string | null;
    stage_id: number | null;
    stage?: { id: number; name: string } | null;
    gender: 'boys' | 'girls' | 'mixed' | null;
    zone: string | null;
    email: string | null;
    address: string | null;
    is_active: boolean;
    principal?: { id: number; name: string } | null;
}

export interface Teacher {
    id: number;
    school_id: number;
    department_id: number;
    name: string;
    employee_no: string | null;
    national_id: string | null;
    gender: 'male' | 'female' | null;
    nationality: string | null;
    birth_date: string | null;
    job_title: string | null;
    academic_degree: string | null;
    specialization: string | null;
    ministry_hire_date: string | null;
    license_level: string | null;
    license_year: string | null;
    residential_zone: string | null;
    sections_count: number;
    quota: number | null;
    email: string | null;
    phone: string | null;
    is_active: boolean;
    /** للمعلّم غير النشط: اسم المدرسة التي انتقل إليها (نشط الآن)، أو null إن استقال/غير معروف. */
    transferred_to?: string | null;
    /** هل المعلم منسق المادة حاليًا (تكليف تنسيق نشط)؟ */
    is_coordinator?: boolean;
    grades?: { id: number; name: string }[];
}

/** خطوة معاينة الاستيراد المشتركة. */
export interface ImportPreview {
    rows: Array<Record<string, string | number> & { row: number; status: 'new' | 'update' | 'error'; message: string }>;
    summary: { new: number; update: number; error: number; deactivate?: number };
    total: number;
}

export interface ImportData {
    preview: ImportPreview;
    token: string;
    originalName: string;
    /** القسم المستهدف بالاستيراد (لفتح بطاقته في صفحة المدرسة). */
    department_id?: number;
}

export interface DomainUser {
    id: number;
    name: string;
    email: string;
    phone: string | null;
    department_id: number | null;
    department?: { id: number; name: string } | null;
    gender: 'male' | 'female' | null;
    roles?: Role[];
    is_active: boolean;
    last_login_at?: string | null;
}

export interface Semester {
    id: number;
    academic_year_id: number;
    name: string;
    start_date?: string | null;
    end_date?: string | null;
    is_active: boolean;
}

export interface AcademicYear {
    id: number;
    name: string;
    start_date?: string | null;
    end_date?: string | null;
    is_active: boolean;
    semesters?: Semester[];
    semesters_count?: number;
}

export interface AcademicContext {
    years: { id: number; name: string; is_active: boolean }[];
    semesters: { id: number; name: string; is_active: boolean; academic_year_id: number }[];
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

/* ===================== الإشعارات ===================== */

export interface NotificationItem {
    id: string;
    type: string;
    title: string;
    message: string;
    url: string | null;
    icon: string | null;
    read_at: string | null;
    created_at: string;
}

export interface NotificationsShared {
    unread_count: number;
    items: NotificationItem[];
}

/** نوع إشعار قابل للضبط (لصفحة الإعدادات). */
export interface NotificationTypeSetting {
    type: string;
    label: string;
    description: string;
    enabled: boolean;
    recipient_roles: string[];
    department_scoped: boolean;
    live: boolean;
}

export interface SharedData {
    name: string;
    quote: { message: string; author: string };
    auth: Auth;
    notifications?: NotificationsShared;
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
