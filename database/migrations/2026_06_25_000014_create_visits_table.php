<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('visits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('academic_year_id')->constrained('academic_years')->cascadeOnDelete();
            $table->foreignId('semester_id')->constrained('semesters')->cascadeOnDelete();
            $table->foreignId('supervisor_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('school_id')->constrained('schools')->cascadeOnDelete();
            $table->foreignId('department_id')->constrained('departments')->cascadeOnDelete();
            $table->enum('visit_type', ['teacher', 'coordinator']);
            $table->morphs('visitable'); // teacher أو coordinator
            $table->date('visit_date');
            $table->enum('status', ['scheduled', 'done', 'late'])->default('done');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['academic_year_id', 'semester_id', 'supervisor_id', 'status'], 'visits_context_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('visits');
    }
};
