<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * مهام التقويم — مهمّة شخصية (يراها مُنشئها فقط) أو مهمّة مُسندة
 * (للجميع / لرؤساء الأقسام / لمستخدمين محدّدين) لها تاريخ بدء وموعد انتهاء.
 * المُسنَد إليهم يُسجَّلون في calendar_task_assignees لتتبّع من أنجز ومن لا يزال يعمل.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('calendar_tasks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('creator_id')->constrained('users')->cascadeOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            // نوع الحدث: عام / اجتماع / إنجاز تقرير — يكشف حقولًا إضافية في الواجهة فقط
            $table->enum('category', ['general', 'meeting', 'report'])->default('general');
            // الأولوية: عادي / متوسط / عاجل / شديد الأهمية
            $table->enum('priority', ['normal', 'medium', 'urgent', 'critical'])->default('normal')->index();
            // الجمهور المستهدف
            $table->enum('audience', ['personal', 'all', 'department_heads', 'specific'])->default('personal')->index();
            $table->string('color', 20)->nullable();            // لون مخصّص (اختياري)
            $table->date('start_date')->index();                // اليوم الذي يظهر فيه على التقويم
            $table->date('due_date')->nullable();               // موعد الانتهاء (اختياري)
            $table->time('start_time')->nullable();             // من (للاجتماعات)
            $table->time('end_time')->nullable();               // إلى
            $table->string('location')->nullable();             // المكان
            $table->foreignId('department_id')->nullable()->constrained('departments')->nullOnDelete();
            $table->timestamps();

            $table->index(['creator_id', 'start_date']);
        });

        Schema::create('calendar_task_assignees', function (Blueprint $table) {
            $table->id();
            $table->foreignId('calendar_task_id')->constrained('calendar_tasks')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->enum('status', ['pending', 'done'])->default('pending');
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->unique(['calendar_task_id', 'user_id']);
            $table->index(['user_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('calendar_task_assignees');
        Schema::dropIfExists('calendar_tasks');
    }
};
