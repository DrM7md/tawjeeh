<?php

use App\Http\Controllers\AcademicYearController;
use App\Http\Controllers\AuditLogController;
use App\Http\Controllers\BackupController;
use App\Http\Controllers\CalendarController;
use App\Http\Controllers\ClassificationController;
use App\Http\Controllers\ContextController;
use App\Http\Controllers\CoordinatorController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DepartmentController;
use App\Http\Controllers\DistributionController;
use App\Http\Controllers\ImprovementPlanController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\NotificationSettingController;
use App\Http\Controllers\PortfolioReviewController;
use App\Http\Controllers\PortfolioTemplateController;
use App\Http\Controllers\ReviewFormController;
use App\Http\Controllers\SchoolImportController;
use App\Http\Controllers\SchoolPrincipalController;
use App\Http\Controllers\SchoolTeacherController;
use App\Http\Controllers\SupervisionReportController;
use App\Http\Controllers\TestReviewController;
use App\Http\Controllers\VisitController;
use App\Http\Controllers\VisitFormController;
use App\Http\Controllers\VisitTemplateController;
use App\Http\Controllers\OrganizationSettingsController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\RosterImportController;
use App\Http\Controllers\SchoolController;
use App\Http\Controllers\SemesterController;
use App\Http\Controllers\StatisticsController;
use App\Http\Controllers\SupervisorPlanController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\UserImportController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return auth()->check() ? redirect()->route('dashboard') : redirect()->route('login');
})->name('home');

Route::middleware(['auth'])->group(function () {
    Route::get('dashboard', [DashboardController::class, 'index'])->name('dashboard');

    /* ===================== الهيكل التنظيمي (Phase 1) ===================== */

    // الأقسام
    Route::middleware('can:departments.view')->group(function () {
        Route::get('departments', [DepartmentController::class, 'index'])->name('departments.index');
    });
    Route::middleware('can:departments.manage')->group(function () {
        Route::post('departments', [DepartmentController::class, 'store'])->name('departments.store');
        Route::put('departments/{department}', [DepartmentController::class, 'update'])->name('departments.update');
        Route::delete('departments/{department}', [DepartmentController::class, 'destroy'])->name('departments.destroy');
    });

    // المدارس
    Route::middleware('can:schools.view')->group(function () {
        Route::get('schools', [SchoolController::class, 'index'])->name('schools.index');
        Route::get('schools-statistics', [StatisticsController::class, 'schools'])->name('schools.statistics');
        Route::get('schools/{school}', [SchoolController::class, 'show'])->name('schools.show');
        Route::get('schools/{school}/teachers/export', [SchoolTeacherController::class, 'export'])->name('schools.teachers.export');
        Route::get('schools/{school}/teachers/template', [SchoolTeacherController::class, 'template'])->name('schools.teachers.template');
        // الملف الشخصي للمعلم — بعد المسارات الساكنة كي لا يلتقطها {teacher}
        Route::get('schools/{school}/teachers/{teacher}', [SchoolTeacherController::class, 'show'])->name('schools.teachers.show');
    });
    Route::middleware('can:schools.manage')->group(function () {
        Route::post('schools', [SchoolController::class, 'store'])->name('schools.store');
        Route::put('schools/{school}', [SchoolController::class, 'update'])->name('schools.update');
        Route::delete('schools/{school}', [SchoolController::class, 'destroy'])->name('schools.destroy');

        Route::get('schools-export', [SchoolImportController::class, 'export'])->name('schools.export');
        Route::get('schools-template', [SchoolImportController::class, 'template'])->name('schools.template');
        Route::post('schools-import/preview', [SchoolImportController::class, 'preview'])->name('schools.import.preview');
        Route::post('schools-import', [SchoolImportController::class, 'store'])->name('schools.import.store');
    });
    // المنسقون — صفحة العرض + التصدير + التنزيل لمعلم
    Route::middleware('can:coordinators.view')->group(function () {
        Route::get('coordinators', [CoordinatorController::class, 'index'])->name('coordinators.index');
        Route::get('coordinators-export', [CoordinatorController::class, 'export'])->name('coordinators.export');
    });
    Route::middleware('can:coordinators.manage')->group(function () {
        Route::post('coordinators/{assignment}/demote', [CoordinatorController::class, 'demote'])->name('coordinators.demote');
    });

    // محرك التصنيف ومتطلبات المتابعة — لوحة الالتزام + تصنيف + اعتماد
    Route::middleware('can:classification.view')->group(function () {
        Route::get('classification', [ClassificationController::class, 'index'])->name('classification.index');
    });
    Route::middleware('can:classification.classify')->post('classification/classify', [ClassificationController::class, 'classify'])->name('classification.classify');
    Route::middleware('can:classification.approve')->post('classification/records/{record}/approve', [ClassificationController::class, 'approve'])->name('classification.approve');

    // الاستيراد الموحّد (مدارس + معلمون + منسقون) — عملية إدارية
    Route::middleware(['can:schools.manage', 'can:import.run'])->group(function () {
        Route::get('roster-import', [RosterImportController::class, 'index'])->name('roster-import.index');
        Route::get('roster-import/template', [RosterImportController::class, 'template'])->name('roster-import.template');
        Route::post('roster-import/preview', [RosterImportController::class, 'preview'])->name('roster-import.preview');
        Route::post('roster-import', [RosterImportController::class, 'store'])->name('roster-import.store');
        Route::get('roster-import/{batch}/errors', [RosterImportController::class, 'showErrors'])->name('roster-import.errors');
    });

    // قالب كشف المعلمين (قائمة المدرسة من المدارس النشطة) — متاح لمن يملك صلاحية الاستيراد
    Route::middleware('can:import.run')->get('schools-roster-template', [RosterImportController::class, 'rosterTemplate'])->name('schools.roster-template');

    // استيراد معلمي القسم + إدارة صفوفهم (الموجه) — يتطلب صلاحية الاستيراد + إسناد المدرسة
    Route::middleware('can:import.run')->group(function () {
        Route::post('schools/{school}/teachers/import/preview', [SchoolTeacherController::class, 'preview'])->name('schools.teachers.import.preview');
        Route::post('schools/{school}/teachers/import', [SchoolTeacherController::class, 'store'])->name('schools.teachers.import.store');
        Route::put('schools/{school}/teachers/{teacher}/grades', [SchoolTeacherController::class, 'updateGrades'])->name('schools.teachers.grades');
    });

    // المستخدمون
    Route::middleware('can:users.view')->group(function () {
        Route::get('users', [UserController::class, 'index'])->name('users.index');
        // مسارات ساكنة بشرطة قبل {user} لتفادي التقاطها بالربط التلقائي
        Route::get('users-export', [UserImportController::class, 'export'])->name('users.export');
        Route::get('users-template', [UserImportController::class, 'template'])->name('users.template');
        Route::get('users-statistics', [StatisticsController::class, 'users'])->name('users.statistics');
        Route::get('users/{user}', [UserController::class, 'show'])->name('users.show');
    });
    Route::middleware('can:users.create')->group(function () {
        Route::post('users', [UserController::class, 'store'])->name('users.store');
        Route::post('users-import/preview', [UserImportController::class, 'preview'])->name('users.import.preview');
        Route::post('users-import', [UserImportController::class, 'store'])->name('users.import.store');
    });
    Route::middleware('can:users.update')->put('users/{user}', [UserController::class, 'update'])->name('users.update');
    Route::middleware('can:users.delete')->delete('users/{user}', [UserController::class, 'destroy'])->name('users.destroy');

    // الأدوار والصلاحيات
    Route::middleware('can:roles.view')->get('roles', [RoleController::class, 'index'])->name('roles.index');
    Route::middleware('can:roles.manage')->group(function () {
        Route::post('roles', [RoleController::class, 'store'])->name('roles.store');
        Route::put('roles/{role}', [RoleController::class, 'update'])->name('roles.update');
        Route::delete('roles/{role}', [RoleController::class, 'destroy'])->name('roles.destroy');
    });

    /* ===================== الأعوام والفصول + السياق (Phase 2) ===================== */

    // تبديل العام/الفصل المختار — متاح لكل مستخدم
    Route::post('context', [ContextController::class, 'update'])->name('context.update');

    /* ===================== التقويم والمهام ===================== */
    Route::middleware('can:calendar.view')->group(function () {
        Route::get('calendar', [CalendarController::class, 'index'])->name('calendar.index');
        Route::post('calendar', [CalendarController::class, 'store'])->name('calendar.store');
        // مسارات ساكنة قبل {task} كي لا يلتقطها الربط التلقائي
        Route::post('calendar/{task}/move', [CalendarController::class, 'move'])->name('calendar.move');
        Route::post('calendar/{task}/toggle', [CalendarController::class, 'toggle'])->name('calendar.toggle');
        Route::put('calendar/{task}', [CalendarController::class, 'update'])->name('calendar.update');
        Route::delete('calendar/{task}', [CalendarController::class, 'destroy'])->name('calendar.destroy');
    });

    /* ===================== الإشعارات ===================== */
    Route::get('notifications', [NotificationController::class, 'index'])->name('notifications.index');
    // read-all قبل {id} كي لا يلتقطها الربط كمعرّف
    Route::post('notifications/read-all', [NotificationController::class, 'markAllRead'])->name('notifications.read-all');
    Route::post('notifications/{id}/read', [NotificationController::class, 'markRead'])->name('notifications.read');

    // ضبط أنواع الإشعارات (من يستلم + التفعيل + البث)
    Route::middleware('can:settings.manage')->group(function () {
        Route::get('notification-settings', [NotificationSettingController::class, 'index'])->name('notification-settings.index');
        Route::put('notification-settings', [NotificationSettingController::class, 'update'])->name('notification-settings.update');
    });

    Route::middleware('can:academic.view')->get('academic', [AcademicYearController::class, 'index'])->name('academic.index');

    Route::middleware('can:academic.manage')->group(function () {
        Route::post('academic-years', [AcademicYearController::class, 'store'])->name('academic-years.store');
        Route::put('academic-years/{academicYear}', [AcademicYearController::class, 'update'])->name('academic-years.update');
        Route::post('academic-years/{academicYear}/activate', [AcademicYearController::class, 'activate'])->name('academic-years.activate');
        Route::delete('academic-years/{academicYear}', [AcademicYearController::class, 'destroy'])->name('academic-years.destroy');

        Route::post('semesters', [SemesterController::class, 'store'])->name('semesters.store');
        Route::put('semesters/{semester}', [SemesterController::class, 'update'])->name('semesters.update');
        Route::post('semesters/{semester}/activate', [SemesterController::class, 'activate'])->name('semesters.activate');
        Route::delete('semesters/{semester}', [SemesterController::class, 'destroy'])->name('semesters.destroy');
    });

    /* ===================== توزيع المدارس (Phase 3) ===================== */
    Route::middleware('can:distribution.view')->get('distribution', [DistributionController::class, 'index'])->name('distribution.index');
    Route::middleware('can:distribution.auto')->post('distribution/auto-preview', [DistributionController::class, 'autoPreview'])->name('distribution.auto-preview');
    Route::middleware('can:distribution.manual')->group(function () {
        Route::post('distribution/apply', [DistributionController::class, 'apply'])->name('distribution.apply');
        Route::post('distribution/assign', [DistributionController::class, 'assign'])->name('distribution.assign');
        Route::post('distribution/unassign', [DistributionController::class, 'unassign'])->name('distribution.unassign');
    });
    Route::middleware('can:distribution.redistribute')->post('distribution/clear', [DistributionController::class, 'clear'])->name('distribution.clear');

    /* ===================== التخطيط — خطة الموجّه (وحدة التخطيط) ===================== */
    Route::middleware('can:planning.view.own')->get('planning', [SupervisorPlanController::class, 'index'])->name('planning.index');
    Route::middleware('can:planning.create')->group(function () {
        Route::post('planning/generate-preview', [SupervisorPlanController::class, 'generatePreview'])->name('planning.generate-preview');
        Route::post('planning', [SupervisorPlanController::class, 'store'])->name('planning.store');
        Route::post('planning/{plan}/submit', [SupervisorPlanController::class, 'submit'])->name('planning.submit');
    });
    Route::middleware('can:planning.approve')->group(function () {
        Route::post('planning/{plan}/approve', [SupervisorPlanController::class, 'approve'])->name('planning.approve');
        Route::post('planning/{plan}/return', [SupervisorPlanController::class, 'returnForRevision'])->name('planning.return');
    });

    /* ===================== الزيارات والاستمارات (Phase 5) ===================== */
    Route::middleware('can:visits.view.own')->group(function () {
        Route::get('visits', [VisitController::class, 'index'])->name('visits.index');
        Route::get('visits-statistics', [StatisticsController::class, 'visits'])->name('visits.statistics');
        // مسارات ساكنة قبل {visit} كي لا يلتقطها الربط التلقائي
        Route::get('visits/teacher-context', [VisitController::class, 'teacherContext'])->name('visits.teacher-context');
        Route::get('visits/create', [VisitController::class, 'create'])->middleware('can:visits.create')->name('visits.create');
        Route::get('visits/{visit}/edit', [VisitController::class, 'edit'])->middleware('can:visits.update')->name('visits.edit');
        Route::get('visits/{visit}/print', [VisitController::class, 'printVisit'])->name('visits.print');
        Route::get('visits/{visit}', [VisitController::class, 'show'])->name('visits.show');
    });
    Route::middleware('can:visits.create')->group(function () {
        Route::post('visits', [VisitController::class, 'store'])->name('visits.store');
        Route::delete('visits/{visit}', [VisitController::class, 'destroy'])->name('visits.destroy');
    });
    Route::middleware('can:visits.update')->put('visits/{visit}', [VisitController::class, 'update'])->name('visits.update');

    // تقارير الزيارات الإشرافية (صفحات + طباعة)
    Route::middleware('can:visits.view.own')->group(function () {
        Route::get('supervision-reports/department', [SupervisionReportController::class, 'department'])->name('supervision-reports.department');
        Route::get('supervision-reports/comparison', [SupervisionReportController::class, 'comparison'])->name('supervision-reports.comparison');
        Route::get('supervision-reports/performance', [SupervisionReportController::class, 'performance'])->name('supervision-reports.performance');
        Route::get('supervision-reports/coverage', [SupervisionReportController::class, 'coverage'])->name('supervision-reports.coverage');
        Route::get('supervision-reports/recommendations', [SupervisionReportController::class, 'recommendations'])->name('supervision-reports.recommendations');
        Route::get('supervision-reports/cross-year', [SupervisionReportController::class, 'crossYear'])->name('supervision-reports.cross-year');
        Route::get('supervision-reports/print', [SupervisionReportController::class, 'print'])->name('supervision-reports.print');
    });
    Route::middleware('can:visits.update')->post('supervision-reports/followup', [SupervisionReportController::class, 'saveFollowup'])->name('supervision-reports.followup');
    Route::middleware('can:forms.fill')->group(function () {
        Route::post('visits/{visit}/form', [VisitFormController::class, 'save'])->name('visits.form.save');
        Route::post('visits/{visit}/files', [VisitFormController::class, 'uploadFile'])->name('visits.files.upload');
        Route::delete('visit-files/{file}', [VisitFormController::class, 'destroyFile'])->name('visits.files.destroy');
    });
    Route::middleware('can:visits.view.own')->get('visit-files/{file}/download', [VisitFormController::class, 'downloadFile'])->name('visits.files.download');

    /* ===================== تحكيم الاختبارات (Phase 6) ===================== */
    Route::middleware('can:reviews.view.own')->group(function () {
        Route::get('reviews', [TestReviewController::class, 'index'])->name('reviews.index');
        Route::get('reviews-statistics', [StatisticsController::class, 'reviews'])->name('reviews.statistics');
        Route::get('reviews/{testReview}/print', [TestReviewController::class, 'printForm'])->name('reviews.print');
        Route::get('reviews/{testReview}', [TestReviewController::class, 'show'])->name('reviews.show');
    });
    Route::middleware('can:reviews.create')->group(function () {
        Route::post('reviews', [TestReviewController::class, 'store'])->name('reviews.store');
        Route::post('reviews/{testReview}/form', [TestReviewController::class, 'saveForm'])->name('reviews.form.save');
        Route::post('reviews/{testReview}/files', [TestReviewController::class, 'uploadFile'])->name('reviews.files.upload');
        Route::delete('review-files/{file}', [TestReviewController::class, 'destroyFile'])->name('reviews.files.destroy');
        Route::delete('reviews/{testReview}', [TestReviewController::class, 'destroy'])->name('reviews.destroy');
    });
    Route::middleware('can:reviews.view.own')->get('review-files/{file}/download', [TestReviewController::class, 'downloadFile'])->name('reviews.files.download');

    /* ===================== خطط التحسين والتطوير الذاتي (Phase 1.3) ===================== */
    Route::middleware('can:improvement.view.own')->group(function () {
        Route::get('improvement', [ImprovementPlanController::class, 'index'])->name('improvement.index');
        Route::get('improvement/{plan}', [ImprovementPlanController::class, 'show'])->name('improvement.show');
    });
    Route::middleware('can:improvement.create')->group(function () {
        Route::post('improvement', [ImprovementPlanController::class, 'store'])->name('improvement.store');
        Route::post('improvement-self', [ImprovementPlanController::class, 'storeSelf'])->name('improvement.self.store');
        Route::delete('improvement/{plan}', [ImprovementPlanController::class, 'destroy'])->name('improvement.destroy');
        Route::delete('improvement-self/{selfPlan}', [ImprovementPlanController::class, 'destroySelf'])->name('improvement.self.destroy');
    });
    Route::middleware('can:improvement.update')->group(function () {
        Route::put('improvement/{plan}', [ImprovementPlanController::class, 'update'])->name('improvement.update');
        Route::post('improvement/{plan}/reviews', [ImprovementPlanController::class, 'storeReview'])->name('improvement.reviews.store');
        Route::delete('improvement-reviews/{review}', [ImprovementPlanController::class, 'destroyReview'])->name('improvement.reviews.destroy');
        Route::put('improvement-self/{selfPlan}', [ImprovementPlanController::class, 'updateSelf'])->name('improvement.self.update');
    });

    /* ===================== تقييم ملفات المنسق ===================== */
    Route::middleware('can:portfolios.view.own')->group(function () {
        Route::get('portfolios', [PortfolioReviewController::class, 'index'])->name('portfolios.index');
        // مسارات ساكنة قبل {portfolioReview} كي لا يلتقطها الربط التلقائي
        Route::get('portfolios/{portfolioReview}/print', [PortfolioReviewController::class, 'printReview'])->name('portfolios.print');
        Route::get('portfolios/{portfolioReview}', [PortfolioReviewController::class, 'show'])->name('portfolios.show');
        Route::get('portfolio-scores/{score}/download', [PortfolioReviewController::class, 'downloadAttachment'])->name('portfolios.scores.download');
    });
    Route::middleware('can:portfolios.create')->group(function () {
        Route::post('portfolios', [PortfolioReviewController::class, 'store'])->name('portfolios.store');
        Route::post('portfolios/{portfolioReview}/form', [PortfolioReviewController::class, 'saveForm'])->name('portfolios.form.save');
        Route::post('portfolio-scores/{score}/attachment', [PortfolioReviewController::class, 'uploadAttachment'])->name('portfolios.scores.attachment');
        Route::delete('portfolio-scores/{score}/attachment', [PortfolioReviewController::class, 'destroyAttachment'])->name('portfolios.scores.attachment.destroy');
        Route::delete('portfolios/{portfolioReview}', [PortfolioReviewController::class, 'destroy'])->name('portfolios.destroy');
    });

    /* ===================== سجل النشاط + النسخ الاحتياطي (Phase 8) ===================== */
    Route::middleware('can:audit.view')->get('audit', [AuditLogController::class, 'index'])->name('audit.index');
    Route::middleware('can:backup.manage')->group(function () {
        Route::get('backups', [BackupController::class, 'index'])->name('backups.index');
        Route::post('backups/run', [BackupController::class, 'run'])->name('backups.run');
        Route::get('backups/{name}/download', [BackupController::class, 'download'])->name('backups.download');
        Route::delete('backups/{name}', [BackupController::class, 'destroy'])->name('backups.destroy');
    });

    // إعدادات الهيكل (المراحل + التصنيفات)
    Route::middleware('can:settings.manage')->group(function () {
        Route::get('organization-settings', [OrganizationSettingsController::class, 'index'])->name('org-settings.index');

        // سجل مدراء المدارس عبر الأعوام
        Route::get('principals', [SchoolPrincipalController::class, 'index'])->name('principals.index');

        /* ===================== قوالب الإشراف (المجالات/المعايير) ===================== */
        Route::get('supervision-templates', [VisitTemplateController::class, 'index'])->name('supervision-templates.index');
        Route::post('supervision-templates', [VisitTemplateController::class, 'store'])->name('supervision-templates.store');
        // المسارات الساكنة قبل {template} كي لا يلتقطها الربط التلقائي
        Route::post('supervision-templates/note-presets', [VisitTemplateController::class, 'saveNotePresets'])->name('supervision-templates.note-presets');
        Route::post('supervision-templates/follow-up-types', [VisitTemplateController::class, 'saveFollowUpTypes'])->name('supervision-templates.follow-up-types');
        Route::get('supervision-templates/{template}', [VisitTemplateController::class, 'show'])->name('supervision-templates.show');
        Route::put('supervision-templates/{template}', [VisitTemplateController::class, 'update'])->name('supervision-templates.update');
        Route::delete('supervision-templates/{template}', [VisitTemplateController::class, 'destroy'])->name('supervision-templates.destroy');
        Route::post('supervision-templates/{template}/link-department', [VisitTemplateController::class, 'linkDepartment'])->name('supervision-templates.link-department');
        Route::delete('supervision-templates/{template}/departments/{department}', [VisitTemplateController::class, 'unlinkDepartment'])->name('supervision-templates.unlink-department');
        Route::post('supervision-templates/{template}/domains', [VisitTemplateController::class, 'storeDomain'])->name('supervision-templates.domains.store');
        // بنية مسطّحة للمجالات/المعايير/التوصيات (تفادي التداخل العميق)
        Route::put('supervision-domains/{domain}', [VisitTemplateController::class, 'updateDomain'])->name('supervision-domains.update');
        Route::delete('supervision-domains/{domain}', [VisitTemplateController::class, 'destroyDomain'])->name('supervision-domains.destroy');
        Route::post('supervision-domains/{domain}/standards', [VisitTemplateController::class, 'storeStandard'])->name('supervision-domains.standards.store');
        Route::put('supervision-standards/{standard}', [VisitTemplateController::class, 'updateStandard'])->name('supervision-standards.update');
        Route::delete('supervision-standards/{standard}', [VisitTemplateController::class, 'destroyStandard'])->name('supervision-standards.destroy');
        Route::post('supervision-standards/{standard}/recommendations', [VisitTemplateController::class, 'storeRecommendation'])->name('supervision-standards.recommendations.store');
        Route::delete('supervision-recommendations/{recommendation}', [VisitTemplateController::class, 'destroyRecommendation'])->name('supervision-recommendations.destroy');

        Route::post('stages', [OrganizationSettingsController::class, 'storeStage'])->name('stages.store');
        Route::put('stages/{stage}', [OrganizationSettingsController::class, 'updateStage'])->name('stages.update');
        Route::delete('stages/{stage}', [OrganizationSettingsController::class, 'destroyStage'])->name('stages.destroy');

        Route::post('classifications', [OrganizationSettingsController::class, 'storeClassification'])->name('classifications.store');
        Route::put('classifications/{classification}', [OrganizationSettingsController::class, 'updateClassification'])->name('classifications.update');
        Route::delete('classifications/{classification}', [OrganizationSettingsController::class, 'destroyClassification'])->name('classifications.destroy');

        Route::post('grades', [OrganizationSettingsController::class, 'storeGrade'])->name('grades.store');
        Route::put('grades/{grade}', [OrganizationSettingsController::class, 'updateGrade'])->name('grades.update');
        Route::delete('grades/{grade}', [OrganizationSettingsController::class, 'destroyGrade'])->name('grades.destroy');

        // أنواع أحداث التقويم
        Route::post('calendar-event-types', [OrganizationSettingsController::class, 'storeEventType'])->name('calendar-event-types.store');
        Route::put('calendar-event-types/{eventType}', [OrganizationSettingsController::class, 'updateEventType'])->name('calendar-event-types.update');
        Route::delete('calendar-event-types/{eventType}', [OrganizationSettingsController::class, 'destroyEventType'])->name('calendar-event-types.destroy');

        /* ===================== استمارة التحكيم (المجالات/البنود/المؤشرات) ===================== */
        Route::get('review-form', [ReviewFormController::class, 'index'])->name('review-form.index');
        Route::post('review-domains', [ReviewFormController::class, 'storeDomain'])->name('review-domains.store');
        Route::put('review-domains/{domain}', [ReviewFormController::class, 'updateDomain'])->name('review-domains.update');
        Route::delete('review-domains/{domain}', [ReviewFormController::class, 'destroyDomain'])->name('review-domains.destroy');
        Route::post('review-domains/{domain}/items', [ReviewFormController::class, 'storeItem'])->name('review-items.store');
        Route::put('review-items/{item}', [ReviewFormController::class, 'updateItem'])->name('review-items.update');
        Route::delete('review-items/{item}', [ReviewFormController::class, 'destroyItem'])->name('review-items.destroy');
        Route::post('review-items/{item}/indicators', [ReviewFormController::class, 'storeIndicator'])->name('review-indicators.store');
        Route::put('review-indicators/{indicator}', [ReviewFormController::class, 'updateIndicator'])->name('review-indicators.update');
        Route::delete('review-indicators/{indicator}', [ReviewFormController::class, 'destroyIndicator'])->name('review-indicators.destroy');

        /* ===================== قوالب تقييم ملفات المنسق (القالب ← البنود) ===================== */
        Route::get('portfolio-templates', [PortfolioTemplateController::class, 'index'])->name('portfolio-templates.index');
        Route::post('portfolio-templates', [PortfolioTemplateController::class, 'store'])->name('portfolio-templates.store');
        Route::put('portfolio-templates/{template}', [PortfolioTemplateController::class, 'update'])->name('portfolio-templates.update');
        Route::delete('portfolio-templates/{template}', [PortfolioTemplateController::class, 'destroy'])->name('portfolio-templates.destroy');
        // بنية مسطّحة للبنود (تفادي التداخل العميق)
        Route::post('portfolio-templates/{template}/items', [PortfolioTemplateController::class, 'storeItem'])->name('portfolio-templates.items.store');
        Route::put('portfolio-items/{item}', [PortfolioTemplateController::class, 'updateItem'])->name('portfolio-items.update');
        Route::delete('portfolio-items/{item}', [PortfolioTemplateController::class, 'destroyItem'])->name('portfolio-items.destroy');
    });
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
