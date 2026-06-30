<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * إضافة «مؤشرات الأداء» المنفصلة عن عنوان المجال (وفق استمارة الإشراف الرسمية).
 * تُخزَّن في البنود وتُنسخ لقطةً في درجات التقييم كي لا تتأثر السجلات بتعديل القالب.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('portfolio_review_items', function (Blueprint $table) {
            $table->text('indicators')->nullable()->after('criterion_text'); // مؤشرات الأداء للمجال
        });

        Schema::table('portfolio_review_scores', function (Blueprint $table) {
            $table->text('indicators')->nullable()->after('criterion_text'); // لقطة مؤشرات الأداء وقت التقييم
        });
    }

    public function down(): void
    {
        Schema::table('portfolio_review_items', function (Blueprint $table) {
            $table->dropColumn('indicators');
        });

        Schema::table('portfolio_review_scores', function (Blueprint $table) {
            $table->dropColumn('indicators');
        });
    }
};
