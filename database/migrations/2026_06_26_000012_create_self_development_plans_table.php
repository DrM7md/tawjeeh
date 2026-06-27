<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * خطة تطوير ذاتي للمعلم/المنسق: أهداف يضعها صاحب الخطة + تغذية راجعة من الموجّه.
 * مرتبطة بالعام فقط. المرجع: خريطة التطوير §1.3
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('self_development_plans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('academic_year_id')->constrained('academic_years')->cascadeOnDelete();
            $table->morphs('target');                                 // معلم أو منسق
            $table->foreignId('school_id')->constrained('schools')->cascadeOnDelete();
            $table->foreignId('supervisor_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('department_id')->constrained('departments')->cascadeOnDelete();
            $table->json('goals')->nullable();                        // أهداف التطوير الذاتي (قائمة نصوص)
            $table->text('supervisor_feedback')->nullable();          // تغذية راجعة من الموجّه
            $table->enum('status', ['active', 'completed', 'cancelled'])->default('active')->index();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['academic_year_id', 'supervisor_id', 'status'], 'self_dev_plans_context_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('self_development_plans');
    }
};
