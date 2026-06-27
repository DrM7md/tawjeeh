<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('portfolio_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('academic_year_id')->constrained('academic_years')->cascadeOnDelete();
            $table->foreignId('semester_id')->constrained('semesters')->cascadeOnDelete();
            // المنسق = معلم له تكليف تنسيق (CoordinatorAssignment). نربط بالمعلم لثبات الهوية عبر الأعوام.
            $table->foreignId('teacher_id')->constrained('teachers')->cascadeOnDelete();
            $table->foreignId('supervisor_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('department_id')->constrained('departments')->cascadeOnDelete();
            // القالب يُحتفظ به للمرجع؛ البنود تُنسخ لقطةً في الدرجات كي لا يتأثر السجل بتعديل القالب
            $table->foreignId('portfolio_review_template_id')->nullable()->constrained('portfolio_review_templates')->nullOnDelete();
            $table->decimal('total_score', 6, 2)->nullable();
            $table->string('result')->nullable();   // التقدير (يُحسب آليًا)
            $table->enum('status', ['draft', 'final'])->default('draft');
            $table->date('reviewed_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['academic_year_id', 'semester_id', 'supervisor_id'], 'pr_context_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('portfolio_reviews');
    }
};
