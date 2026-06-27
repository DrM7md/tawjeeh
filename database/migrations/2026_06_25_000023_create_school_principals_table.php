<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * مدير المدرسة مربوط بالعام الدراسي — كل عام له مديره، مع حفظ السجل التاريخي.
     */
    public function up(): void
    {
        Schema::create('school_principals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('academic_year_id')->constrained('academic_years')->cascadeOnDelete();
            $table->foreignId('school_id')->constrained('schools')->cascadeOnDelete();
            $table->string('name');
            $table->timestamps();

            // مدير واحد لكل مدرسة في كل عام
            $table->unique(['academic_year_id', 'school_id'], 'principal_year_school_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('school_principals');
    }
};
