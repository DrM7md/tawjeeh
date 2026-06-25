<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('visit_files', function (Blueprint $table) {
            $table->id();
            $table->foreignId('visit_form_id')->constrained('visit_forms')->cascadeOnDelete();
            $table->string('path');             // تخزين خاص
            $table->string('original_name');
            $table->string('mime')->nullable();
            $table->unsignedBigInteger('size')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('visit_files');
    }
};
