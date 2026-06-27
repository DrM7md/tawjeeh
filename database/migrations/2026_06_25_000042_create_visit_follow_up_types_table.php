<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * أنواع المتابعة (نوع الزيارة الصفية) — قائمة قابلة للتعديل من الإعدادات،
 * تظهر كخيارات في استمارة الزيارة. تُخزَّن قيمتها كنص على الزيارة.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('visit_follow_up_types', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('visit_follow_up_types');
    }
};
