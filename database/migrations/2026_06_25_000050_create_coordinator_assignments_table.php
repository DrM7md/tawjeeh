<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * تكليف معلم بمهمة التنسيق (سجل تاريخي).
 * المنسق = معلم له تكليف نشط (status=active, end_date=null) في العام المختار.
 * «التنزيل كمعلم» يُغلق التكليف (end_date=اليوم، status=ended) دون فقد السجل.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('coordinator_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('academic_year_id')->constrained('academic_years')->cascadeOnDelete();
            $table->foreignId('teacher_id')->constrained('teachers')->cascadeOnDelete();
            $table->foreignId('school_id')->constrained('schools')->cascadeOnDelete();
            $table->foreignId('department_id')->constrained('departments')->cascadeOnDelete();
            $table->date('start_date');                          // تاريخ التعيين في التنسيق (قد يكون في الماضي)
            $table->date('end_date')->nullable();                // يُملأ عند التنزيل
            $table->string('status')->default('active');         // active | ended
            $table->string('ended_reason')->nullable();          // سبب التنزيل
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['academic_year_id', 'status']);
            $table->index(['school_id', 'department_id']);
            // تكليف نشط واحد لكل معلم في العام (يُضمن منطقيًا في الخدمة أيضًا).
            $table->index(['teacher_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('coordinator_assignments');
    }
};
