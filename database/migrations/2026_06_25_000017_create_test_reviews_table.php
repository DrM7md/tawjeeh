<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('test_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('academic_year_id')->constrained('academic_years')->cascadeOnDelete();
            $table->foreignId('semester_id')->constrained('semesters')->cascadeOnDelete();
            $table->foreignId('supervisor_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('school_id')->constrained('schools')->cascadeOnDelete();
            $table->foreignId('department_id')->constrained('departments')->cascadeOnDelete();
            $table->foreignId('stage_id')->nullable()->constrained('stages')->nullOnDelete();
            $table->string('grade')->nullable();           // السابع/الثامن/التاسع/ثانوي
            $table->enum('status', ['draft', 'final'])->default('draft');
            $table->date('reviewed_at')->nullable();
            $table->timestamps();

            $table->index(['academic_year_id', 'semester_id', 'supervisor_id'], 'tr_context_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('test_reviews');
    }
};
