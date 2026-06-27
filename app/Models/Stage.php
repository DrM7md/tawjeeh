<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Stage extends Model
{
    protected $fillable = ['name', 'code', 'sort_order'];

    public $timestamps = true;

    public function grades(): HasMany
    {
        return $this->hasMany(Grade::class)->orderBy('sort_order');
    }
}
