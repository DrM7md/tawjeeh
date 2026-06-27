<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * صفوف خطة الموجّه: لكل معلم/منسق في مدارسه المُسندة عددُ الزيارات المخطّط له
 * (يُولَّد مبدئيًا من تصنيف المعلم required_visits، وقابل للتعديل قبل الإرسال).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('supervisor_plan_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('supervisor_plan_id')->constrained('supervisor_plans')->cascadeOnDelete();
            $table->foreignId('school_id')->constrained('schools')->cascadeOnDelete();
            $table->morphs('visitable'); // teacher أو coordinator (كما في الزيارات)
            $table->foreignId('classification_id')->nullable()->constrained('teacher_classifications')->nullOnDelete();
            $table->unsignedInteger('planned_visits')->default(1);
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['supervisor_plan_id', 'visitable_type', 'visitable_id'], 'plan_item_target_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('supervisor_plan_items');
    }
};
