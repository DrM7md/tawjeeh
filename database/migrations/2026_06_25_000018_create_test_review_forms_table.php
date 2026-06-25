<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('test_review_forms', function (Blueprint $table) {
            $table->id();
            $table->foreignId('test_review_id')->unique()->constrained('test_reviews')->cascadeOnDelete();
            $table->json('criteria')->nullable();          // المعايير ودرجاتها
            $table->decimal('total_score', 6, 2)->nullable();
            $table->text('notes')->nullable();
            $table->string('result')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('test_review_forms');
    }
};
