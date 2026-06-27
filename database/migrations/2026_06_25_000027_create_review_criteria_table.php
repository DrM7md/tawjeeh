<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // معايير تحكيم الاختبارات — قابلة للتعديل والإضافة من الإعدادات
        Schema::create('review_criteria', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->unsignedTinyInteger('max_score')->default(5); // الدرجة القصوى للمعيار
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('review_criteria');
    }
};
