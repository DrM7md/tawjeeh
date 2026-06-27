<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * هيكل استمارة تحكيم الاختبارات الرسمية: المجال ← البنود ← المؤشرات.
 * كل بند يحمل وصفًا فرعيًا، وكل مؤشّر يحمل وزنًا خفيًا (للإحصاء).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('review_domains', function (Blueprint $table) {
            $table->id();
            $table->string('name');            // المجال (الجانب التنظيمي / الأسئلة …)
            $table->string('kind')->default('rating'); // rating | approval (صفوف الاعتماد)
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('review_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('review_domain_id')->constrained()->cascadeOnDelete();
            $table->string('name');            // البند
            $table->text('description')->nullable(); // الوصف الفرعي (الغلاف – التعليمات …)
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('review_indicators', function (Blueprint $table) {
            $table->id();
            $table->foreignId('review_item_id')->constrained()->cascadeOnDelete();
            $table->string('label');           // المؤشّر (مُنسَّق / دقيقة / يحتاج تعديل …)
            $table->unsignedTinyInteger('weight')->default(0); // وزن خفي للإحصاء
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('review_indicators');
        Schema::dropIfExists('review_items');
        Schema::dropIfExists('review_domains');
    }
};
