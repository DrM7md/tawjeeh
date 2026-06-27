<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * خطة الموجّه (وحدة التخطيط — خطة الزيارات والتصنيف).
 * خطة واحدة لكل (موجّه، عام دراسي)، تُولَّد جزئياً من تصنيف المعلمين وتُعتمد من رئيس القسم.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('supervisor_plans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('academic_year_id')->constrained('academic_years')->cascadeOnDelete();
            $table->foreignId('department_id')->constrained('departments')->cascadeOnDelete();
            $table->foreignId('supervisor_id')->constrained('users')->cascadeOnDelete();
            $table->enum('status', ['draft', 'submitted', 'approved', 'rejected'])->default('draft')->index();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('review_notes')->nullable();        // ملاحظات رئيس القسم عند الإرجاع/الاعتماد
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            // خطة واحدة لكل موجّه في العام الواحد
            $table->unique(['academic_year_id', 'supervisor_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('supervisor_plans');
    }
};
