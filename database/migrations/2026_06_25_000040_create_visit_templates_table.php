<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * قوالب استمارات الإشراف: قالب لكل مادة (قسم) — مجالات ← معايير ← توصيات جاهزة.
 * القالب بنية مرجعية غير مرتبطة بالعام (يُعاد استخدامه عبر الأعوام).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('visit_templates', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        // ربط القالب بالأقسام (المواد): كل قسم له قالب واحد يُحمّل تلقائيًا في الاستمارة.
        Schema::create('visit_template_department', function (Blueprint $table) {
            $table->id();
            $table->foreignId('visit_template_id')->constrained('visit_templates')->cascadeOnDelete();
            $table->foreignId('department_id')->constrained('departments')->cascadeOnDelete();
            $table->timestamps();

            $table->unique('department_id'); // قسم واحد ↔ قالب واحد
        });

        Schema::create('visit_domains', function (Blueprint $table) {
            $table->id();
            $table->foreignId('visit_template_id')->constrained('visit_templates')->cascadeOnDelete();
            $table->string('name');
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('visit_standards', function (Blueprint $table) {
            $table->id();
            $table->foreignId('visit_domain_id')->constrained('visit_domains')->cascadeOnDelete();
            $table->text('name');
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        // توصيات جاهزة مقترحة لكل معيار (تُضاف بضغطة في الاستمارة).
        Schema::create('visit_standard_recommendations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('visit_standard_id')->constrained('visit_standards')->cascadeOnDelete();
            $table->text('text');
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        // نصوص جاهزة عامة للملاحظات/التوصيات (تظهر كأزرار في الاستمارة).
        Schema::create('visit_note_presets', function (Blueprint $table) {
            $table->id();
            $table->text('text');
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('visit_note_presets');
        Schema::dropIfExists('visit_standard_recommendations');
        Schema::dropIfExists('visit_standards');
        Schema::dropIfExists('visit_domains');
        Schema::dropIfExists('visit_template_department');
        Schema::dropIfExists('visit_templates');
    }
};
