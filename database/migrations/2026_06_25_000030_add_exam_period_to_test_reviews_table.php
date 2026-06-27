<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('test_reviews', function (Blueprint $table) {
            // الاختبار: أربعة عبر الفصلين (منتصف/نهاية لكل فصل). nullable للسجلات القديمة.
            $table->enum('exam_period', ['mid_first', 'final_first', 'mid_second', 'final_second'])
                ->nullable()->after('grade_track_id');
            $table->index(['academic_year_id', 'exam_period'], 'tr_exam_idx');
        });
    }

    public function down(): void
    {
        Schema::table('test_reviews', function (Blueprint $table) {
            $table->dropIndex('tr_exam_idx');
            $table->dropColumn('exam_period');
        });
    }
};
