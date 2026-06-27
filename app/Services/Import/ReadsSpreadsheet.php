<?php

namespace App\Services\Import;

use Maatwebsite\Excel\Facades\Excel;

/**
 * قراءة ملف Excel/CSV وتحويله لصفوف معيارية حسب خريطة أسماء الأعمدة العربية.
 */
trait ReadsSpreadsheet
{
    /**
     * @param  array<string,list<string>>  $aliases  خريطة: مفتاح => أسماء أعمدة مقبولة
     * @return list<array<string,string>>
     */
    protected function readRows(string $path, array $aliases): array
    {
        $sheets = Excel::toArray(new class {}, $path);
        $rows = $sheets[0] ?? [];
        if (empty($rows)) {
            return [];
        }

        // أوّل صف غير فارغ يحوي أحد أسماء الأعمدة المعروفة هو صف الرأس
        $headerIndex = $this->locateHeaderRow($rows, $aliases);
        $header = array_map(fn ($h) => trim((string) $h), $rows[$headerIndex]);
        $map = $this->mapColumns($header, $aliases);
        $body = array_slice($rows, $headerIndex + 1);

        $result = [];
        foreach ($body as $row) {
            if (count(array_filter($row, fn ($c) => trim((string) $c) !== '')) === 0) {
                continue; // صف فارغ
            }
            $item = [];
            foreach ($map as $key => $idx) {
                $item[$key] = $idx !== null ? trim((string) ($row[$idx] ?? '')) : '';
            }
            $result[] = $item;
        }

        return $result;
    }

    /** يحدد رقم صف الرأس (لتجاوز صفوف العنوان/المعلومات في القوالب المنسّقة). */
    private function locateHeaderRow(array $rows, array $aliases): int
    {
        $known = array_merge(...array_values($aliases));
        foreach ($rows as $i => $row) {
            foreach ($row as $cell) {
                if (in_array(trim((string) $cell), $known, true)) {
                    return $i;
                }
            }
        }

        return 0;
    }

    /** @return array<string,int|null> */
    private function mapColumns(array $header, array $aliases): array
    {
        $map = [];
        foreach ($aliases as $key => $names) {
            $map[$key] = null;
            foreach ($header as $idx => $name) {
                if (in_array($name, $names, true)) {
                    $map[$key] = $idx;
                    break;
                }
            }
        }

        return $map;
    }
}
