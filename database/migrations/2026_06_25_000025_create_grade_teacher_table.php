<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * الصفوف التي يدرّسها المعلم — تُدار من شاشة داخل النظام (لا تُستورد).
     * مرتبطة بسجل المعلم المربوط أصلًا بالعام، فهي طبيعيًا خاصة بكل عام.
     */
    public function up(): void
    {
        Schema::create('grade_teacher', function (Blueprint $table) {
            $table->id();
            $table->foreignId('teacher_id')->constrained('teachers')->cascadeOnDelete();
            $table->foreignId('grade_id')->constrained('grades')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['teacher_id', 'grade_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('grade_teacher');
    }
};
