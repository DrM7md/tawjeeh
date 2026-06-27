<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * مراجعة دورية على خطة تحسين (شهرية للدعم المكثف): التقدّم + الخطوات التالية.
 * المرجع: خريطة التطوير §1.3
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('improvement_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('improvement_plan_id')->constrained('improvement_plans')->cascadeOnDelete();
            $table->date('review_date');
            $table->text('progress_note')->nullable();   // ملاحظة التقدّم
            $table->text('next_steps')->nullable();       // الخطوات التالية
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['improvement_plan_id', 'review_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('improvement_reviews');
    }
};
