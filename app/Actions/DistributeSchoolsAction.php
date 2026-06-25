<?php

namespace App\Actions;

/**
 * خوارزمية التوزيع العادل (least-loaded first) — DS في Brain/05-BUSINESS-RULES.md.
 * تأخذ أوزان المدارس + الموجهين + الأحمال الحالية، وتعيد إسنادًا متوازنًا.
 */
class DistributeSchoolsAction
{
    /**
     * @param  array<int, float>  $schoolWeights  [school_id => weight]
     * @param  list<int>  $supervisorIds
     * @param  array<int, float>  $currentLoads  [supervisor_id => load] (الأحمال المبدئية)
     * @return array<int, int>  [school_id => supervisor_id]
     */
    public function handle(array $schoolWeights, array $supervisorIds, array $currentLoads = []): array
    {
        if (empty($supervisorIds)) {
            return [];
        }

        // حمل ابتدائي لكل موجه
        $loads = [];
        foreach ($supervisorIds as $id) {
            $loads[$id] = $currentLoads[$id] ?? 0.0;
        }

        // رتّب المدارس تنازليًا حسب الوزن (الأثقل أولًا)
        arsort($schoolWeights);

        $result = [];
        foreach ($schoolWeights as $schoolId => $weight) {
            // اختر الموجه الأقل حملًا
            $target = array_keys($loads, min($loads))[0];
            $result[$schoolId] = $target;
            $loads[$target] += max($weight, 1); // وزن أدنى = 1 لكل مدرسة
        }

        return $result;
    }
}
