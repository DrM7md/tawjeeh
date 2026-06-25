<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('semesters', function (Blueprint $table) {
            $table->id();
            $table->foreignId('academic_year_id')->constrained('academic_years')->cascadeOnDelete();
            $table->string('name');                 // الفصل الأول / الفصل الثاني
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->boolean('is_active')->default(false); // واحد نشط داخل العام (SM-2)
            $table->enum('status', ['not_started', 'active', 'ended', 'closed'])->default('not_started');
            $table->timestamps();

            $table->index(['academic_year_id', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('semesters');
    }
};
