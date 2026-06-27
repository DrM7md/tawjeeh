<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('portfolio_review_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('portfolio_review_template_id')->constrained('portfolio_review_templates')->cascadeOnDelete();
            $table->string('criterion_text', 1000);  // نص البند (المعيار)
            $table->unsignedSmallInteger('max_score')->default(5);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('portfolio_review_items');
    }
};
