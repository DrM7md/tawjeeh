<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('test_reviews', function (Blueprint $table) {
            $table->foreignId('grade_id')->nullable()->after('stage_id')->constrained('grades')->nullOnDelete();
            $table->foreignId('grade_track_id')->nullable()->after('grade_id')->constrained('grade_tracks')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('test_reviews', function (Blueprint $table) {
            $table->dropConstrainedForeignId('grade_track_id');
            $table->dropConstrainedForeignId('grade_id');
        });
    }
};
