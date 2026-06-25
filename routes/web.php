<?php

use App\Http\Controllers\AcademicYearController;
use App\Http\Controllers\AuditLogController;
use App\Http\Controllers\BackupController;
use App\Http\Controllers\ContextController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DepartmentController;
use App\Http\Controllers\DistributionController;
use App\Http\Controllers\ImportController;
use App\Http\Controllers\TestReviewController;
use App\Http\Controllers\VisitController;
use App\Http\Controllers\VisitFormController;
use App\Http\Controllers\OrganizationSettingsController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\SchoolController;
use App\Http\Controllers\SemesterController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return Inertia::render('welcome');
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
    });
    Route::middleware('can:schools.manage')->group(function () {
        Route::post('schools', [SchoolController::class, 'store'])->name('schools.store');
        Route::put('schools/{school}', [SchoolController::class, 'update'])->name('schools.update');
        Route::delete('schools/{school}', [SchoolController::class, 'destroy'])->name('schools.destroy');
    });

    // المستخدمون
    Route::middleware('can:users.view')->get('users', [UserController::class, 'index'])->name('users.index');
    Route::middleware('can:users.create')->post('users', [UserController::class, 'store'])->name('users.store');
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

    Route::middleware('can:academic.view')->get('academic', [AcademicYearController::class, 'index'])->name('academic.index');

    Route::middleware('can:academic.manage')->group(function () {
        Route::post('academic-years', [AcademicYearController::class, 'store'])->name('academic-years.store');
        Route::put('academic-years/{academicYear}', [AcademicYearController::class, 'update'])->name('academic-years.update');
        Route::post('academic-years/{academicYear}/activate', [AcademicYearController::class, 'activate'])->name('academic-years.activate');
        Route::post('academic-years/{academicYear}/close', [AcademicYearController::class, 'close'])->name('academic-years.close');
        Route::post('academic-years/{academicYear}/archive', [AcademicYearController::class, 'archive'])->name('academic-years.archive');
        Route::delete('academic-years/{academicYear}', [AcademicYearController::class, 'destroy'])->name('academic-years.destroy');

        Route::post('semesters', [SemesterController::class, 'store'])->name('semesters.store');
        Route::put('semesters/{semester}', [SemesterController::class, 'update'])->name('semesters.update');
        Route::post('semesters/{semester}/activate', [SemesterController::class, 'activate'])->name('semesters.activate');
        Route::post('semesters/{semester}/close', [SemesterController::class, 'close'])->name('semesters.close');
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

    /* ===================== استيراد بيانات المدارس (Phase 4) ===================== */
    Route::middleware('can:import.view')->group(function () {
        Route::get('import', [ImportController::class, 'index'])->name('import.index');
        Route::get('import/template', [ImportController::class, 'template'])->name('import.template');
        Route::get('import/{batch}/errors', [ImportController::class, 'showErrors'])->name('import.errors');
    });
    Route::middleware('can:import.run')->group(function () {
        Route::post('import/preview', [ImportController::class, 'preview'])->name('import.preview');
        Route::post('import', [ImportController::class, 'store'])->name('import.store');
    });

    /* ===================== الزيارات والاستمارات (Phase 5) ===================== */
    Route::middleware('can:visits.view.own')->group(function () {
        Route::get('visits', [VisitController::class, 'index'])->name('visits.index');
        Route::get('visits/{visit}', [VisitController::class, 'show'])->name('visits.show');
    });
    Route::middleware('can:visits.create')->group(function () {
        Route::post('visits', [VisitController::class, 'store'])->name('visits.store');
        Route::delete('visits/{visit}', [VisitController::class, 'destroy'])->name('visits.destroy');
    });
    Route::middleware('can:forms.fill')->group(function () {
        Route::post('visits/{visit}/form', [VisitFormController::class, 'save'])->name('visits.form.save');
        Route::post('visits/{visit}/files', [VisitFormController::class, 'uploadFile'])->name('visits.files.upload');
        Route::delete('visit-files/{file}', [VisitFormController::class, 'destroyFile'])->name('visits.files.destroy');
    });
    Route::middleware('can:visits.view.own')->get('visit-files/{file}/download', [VisitFormController::class, 'downloadFile'])->name('visits.files.download');

    /* ===================== تحكيم الاختبارات (Phase 6) ===================== */
    Route::middleware('can:reviews.view.own')->group(function () {
        Route::get('reviews', [TestReviewController::class, 'index'])->name('reviews.index');
        Route::get('reviews/{testReview}', [TestReviewController::class, 'show'])->name('reviews.show');
    });
    Route::middleware('can:reviews.create')->group(function () {
        Route::post('reviews', [TestReviewController::class, 'store'])->name('reviews.store');
        Route::post('reviews/{testReview}/form', [TestReviewController::class, 'saveForm'])->name('reviews.form.save');
        Route::delete('reviews/{testReview}', [TestReviewController::class, 'destroy'])->name('reviews.destroy');
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

        Route::post('stages', [OrganizationSettingsController::class, 'storeStage'])->name('stages.store');
        Route::put('stages/{stage}', [OrganizationSettingsController::class, 'updateStage'])->name('stages.update');
        Route::delete('stages/{stage}', [OrganizationSettingsController::class, 'destroyStage'])->name('stages.destroy');

        Route::post('classifications', [OrganizationSettingsController::class, 'storeClassification'])->name('classifications.store');
        Route::put('classifications/{classification}', [OrganizationSettingsController::class, 'updateClassification'])->name('classifications.update');
        Route::delete('classifications/{classification}', [OrganizationSettingsController::class, 'destroyClassification'])->name('classifications.destroy');
    });
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
