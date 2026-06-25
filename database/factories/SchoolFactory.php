<?php

namespace Database\Factories;

use App\Models\School;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<School>
 */
class SchoolFactory extends Factory
{
    protected $model = School::class;

    public function definition(): array
    {
        return [
            'name' => 'مدرسة '.$this->faker->unique()->numerify('###'),
            'code' => $this->faker->unique()->numerify('SCH###'),
            'gender' => $this->faker->randomElement(['boys', 'girls', 'mixed']),
            'is_active' => true,
        ];
    }
}
