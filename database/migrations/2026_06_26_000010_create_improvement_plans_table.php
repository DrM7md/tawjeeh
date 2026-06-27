<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * خطة تحسين/تطوير مشتركة (المدرسة + الموجّه) لمعلم أو منسق — مرتبطة بالعام فقط.
 * تُتابَع بمراجعات دورية (شهرية للدعم المكثف) عبر improvement_reviews.
 * المرجع: خريطة التطوير §1.3
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('improvement_plans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('academic_year_id')->constrained('academic_years')->cascadeOnDelete();
            // الهدف متعدد الأشكال: معلم أو منسق (Teacher / Coordinator)
            $table->morphs('target');
            // الملكية المشتركة: المدرسة + الموجّه المسؤول
            $table->foreignId('school_id')->constrained('schools')->cascadeOnDelete();
            $table->foreignId('supervisor_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('department_id')->constrained('departments')->cascadeOnDelete();
            $table->string('title')->nullable();
            $table->json('goals')->nullable();                       // أهداف الخطة (قائمة نصوص)
            $table->enum('status', ['active', 'completed', 'cancelled'])->default('active')->index();
            $table->date('start_date')->nullable();
            $table->date('target_date')->nullable();
            $table->timestamp('last_reminded_at')->nullable();       // آخر تذكير آلي أُرسل (لمنع التكرار اليومي)
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['academic_year_id', 'supervisor_id', 'status'], 'improvement_plans_context_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('improvement_plans');
    }
};
