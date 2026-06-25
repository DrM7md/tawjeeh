<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('teachers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('academic_year_id')->constrained('academic_years')->cascadeOnDelete();
            $table->foreignId('school_id')->constrained('schools')->cascadeOnDelete();
            $table->foreignId('department_id')->constrained('departments')->cascadeOnDelete();
            $table->foreignId('coordinator_id')->nullable()->constrained('coordinators')->nullOnDelete();
            $table->foreignId('stage_id')->nullable()->constrained('stages')->nullOnDelete();
            $table->foreignId('classification_id')->nullable()->constrained('teacher_classifications')->nullOnDelete();
            $table->string('name');
            $table->unsignedInteger('sections_count')->default(0);
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->timestamps();

            $table->index(['academic_year_id', 'school_id', 'department_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('teachers');
    }
};
