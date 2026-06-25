<?php

namespace Database\Factories;

use App\Models\Coordinator;
use App\Models\Department;
use App\Models\School;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Coordinator>
 */
class CoordinatorFactory extends Factory
{
    protected $model = Coordinator::class;

    public function definition(): array
    {
        return [
            'school_id' => School::factory(),
            'department_id' => fn () => Department::query()->value('id') ?? Department::create(['name' => 'قسم اختبار'])->id,
            'name' => 'منسق '.$this->faker->unique()->numerify('###'),
        ];
    }
}
