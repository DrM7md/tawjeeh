<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TeacherClassification extends Model
{
    protected $fillable = ['name', 'code', 'required_visits', 'color'];

    protected function casts(): array
    {
        return ['required_visits' => 'integer'];
    }
}
