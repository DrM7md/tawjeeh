<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('portfolio_reviews', function (Blueprint $table) {
            // التقييم مرتان سنويًا: الفصل الأول / الفصل الثاني
            $table->enum('term', ['first', 'second'])->default('first')->after('semester_id');
            // تقييم واحد لكل منسق في كل فصل من العام
            $table->unique(['academic_year_id', 'teacher_id', 'term'], 'pr_unique_per_term');
        });
    }

    public function down(): void
    {
        Schema::table('portfolio_reviews', function (Blueprint $table) {
            $table->dropUnique('pr_unique_per_term');
            $table->dropColumn('term');
        });
    }
};
