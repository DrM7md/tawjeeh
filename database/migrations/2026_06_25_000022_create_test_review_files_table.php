<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // مرفقات استمارة التحكيم (تخزين خاص غير عام)
        Schema::create('test_review_files', function (Blueprint $table) {
            $table->id();
            $table->foreignId('test_review_id')->constrained('test_reviews')->cascadeOnDelete();
            $table->string('path');
            $table->string('original_name');
            $table->string('mime')->nullable();
            $table->unsignedBigInteger('size')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('test_review_files');
    }
};
