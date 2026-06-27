<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('test_reviews', function (Blueprint $table) {
            // معد الاختبار: معلّم يُختار من معلمي المدرسة في نفس المادة (اختياري)
            $table->foreignId('preparer_id')->nullable()->after('grade_track_id')->constrained('teachers')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('test_reviews', function (Blueprint $table) {
            $table->dropConstrainedForeignId('preparer_id');
        });
    }
};
