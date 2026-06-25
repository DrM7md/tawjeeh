<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('school_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('academic_year_id')->constrained('academic_years')->cascadeOnDelete();
            $table->foreignId('school_id')->constrained('schools')->cascadeOnDelete();
            $table->foreignId('supervisor_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('department_id')->constrained('departments')->cascadeOnDelete();
            $table->enum('assignment_method', ['auto', 'manual'])->default('manual');
            $table->foreignId('assigned_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();

            // مدرسة+قسم لا تُسند لأكثر من موجه في نفس العام (DS-5)
            $table->unique(['academic_year_id', 'school_id', 'department_id'], 'sa_year_school_dept_unique');
            $table->index(['academic_year_id', 'supervisor_id'], 'sa_year_supervisor_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('school_assignments');
    }
};
