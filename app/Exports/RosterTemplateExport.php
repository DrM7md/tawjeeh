<?php

namespace App\Exports;

use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Cell\DataValidation;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/**
 * قالب «كشف معلمي المادة» — يُرسَل لمنسق المادة ليملأه، ويرفعه رئيس القسم.
 *
 * مبدأ التصميم:
 * - عمود «المدرسة» قائمة منسدلة من المدارس النشطة فقط (اختيار لا كتابة) — صفر أخطاء إملائية.
 * - لا عمود «القسم» — الاستيراد مقيّد تلقائيًا بقسم رئيس القسم الذي يرفع الملف.
 * - عمود «التقييم السنوي %»: يكتب المنسق نسبة تقييم نهاية العام الماضي (يقبل 92 أو 92% أو 92٪).
 * - عمود «التصنيف»: لا يختاره المنسق — يُحسب آليًا بمعادلة من حدود قواعد التصنيف (يطبّع رمز النسبة).
 * - عمود «منسق؟» = «نعم» لتحديد منسق المادة.
 *
 * قائمة المدارس تُحقن عبر ورقة مخفية (لتجاوز حدّ 255 حرفًا للقائمة المباشرة عند كثرة المدارس).
 */
class RosterTemplateExport extends FormalExport
{
    private const SCHOOLS_SHEET = 'قائمة_المدارس';

    /** عمود التقييم السنوي (Q) — مصدر معادلة التصنيف المحسوب في العمود R. */
    private const EVAL_COL = 'Q';

    /**
     * @param  list<string>  $schools  أسماء المدارس النشطة (لقائمة المدرسة المنسدلة)
     * @param  list<array{name:string,max:int}>  $classificationRules  قواعد التصنيف مرتّبة تصاعديًا حسب الحدّ الأدنى
     */
    public function __construct(
        private readonly array $schools = [],
        private readonly ?string $departmentName = null,
        private readonly array $classificationRules = [],
        private readonly ?string $yearName = null,
        private readonly int $blankRows = 40,
    ) {}

    protected function reportTitle(): string
    {
        $dept = $this->departmentName ? " مادة {$this->departmentName}" : '';

        return "كشف معلمي{$dept}";
    }

    protected function subtitle(): string
    {
        $parts = array_filter([
            $this->yearName ? "العام: {$this->yearName}" : null,
            'اكتب نسبة التقييم السنوي للعام الماضي (مثل 92) — يُحسب «التصنيف» تلقائيًا — وضع «نعم» أمام منسق المادة',
        ]);

        return implode('   —   ', $parts);
    }

    protected function columns(): array
    {
        return [
            'المدرسة', 'اسم المعلم', 'الرقم الشخصي', 'الرقم الوظيفي', 'الجنس', 'الجنسية',
            'تاريخ الميلاد', 'المسمى الوظيفي', 'الدرجة العلمية', 'التخصص العلمي',
            'تاريخ التعيين في الوزارة', 'مستوى الرخصة المهنية', 'سنة الحصول على الرخصة',
            'المنطقة السكنية', 'البريد الإلكتروني', 'رقم الهاتف',
            'التقييم السنوي %', 'التصنيف', 'منسق؟', 'تاريخ التنسيق',
        ];
    }

    /** صفوف فارغة مع معادلة التصنيف التلقائي في كل صف (تشتقّه من عمود التقييم). */
    protected function rows(): array
    {
        $firstData = 4; // العنوان + المعلومات + الرأس ثم البيانات
        $out = [];
        for ($i = 0; $i < max(1, $this->blankRows); $i++) {
            $row = array_fill(0, 20, '');
            $row[17] = $this->classificationFormula($firstData + $i); // العمود R (فهرس 17)
            $out[] = $row;
        }

        return $out;
    }

    /** القوائم القصيرة المباشرة (المدرسة تُعالَج عبر ورقة مخفية، والتصنيف عبر معادلة). */
    protected function validations(): array
    {
        return array_filter([
            'E' => ['ذكر', 'أنثى'],   // الجنس
            'S' => ['نعم', 'لا'],     // منسق؟
        ], fn ($v) => $v !== []);
    }

    public function columnWidths(): array
    {
        return [
            'A' => 26, 'B' => 26, 'C' => 16, 'D' => 13, 'E' => 9, 'F' => 12,
            'G' => 14, 'H' => 16, 'I' => 14, 'J' => 18, 'K' => 18, 'L' => 16,
            'M' => 14, 'N' => 16, 'O' => 24, 'P' => 14, 'Q' => 15, 'R' => 14, 'S' => 9, 'T' => 14,
        ];
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $sheet = $event->sheet->getDelegate();
                $this->decorate($sheet);
                $this->addSchoolsDropdown($sheet);
            },
        ];
    }

    /**
     * معادلة التصنيف التلقائي لصف معيّن: تطبّع قيمة التقييم (تحذف % و٪، وتحوّل كسر 0.92 إلى 92)
     * ثم تطابقها بحدود القواعد. فارغة إن خلا التقييم، و«؟» إن تعذّر تحليل القيمة.
     */
    private function classificationFormula(int $rowNumber): string
    {
        if ($this->classificationRules === []) {
            return '';
        }

        $cell = self::EVAL_COL.$rowNumber;
        // قيمة رقمية مطبّعة: رقم (ومعاملة الكسر ≤1 كنسبة)، وإلا نصّ بعد إزالة رمزَي النسبة.
        $n = "IF(ISNUMBER({$cell}),IF({$cell}<=1,{$cell}*100,{$cell}),"
            ."VALUE(SUBSTITUTE(SUBSTITUTE(TRIM({$cell}&\"\"),\"%\",\"\"),\"٪\",\"\")))";

        $rules = $this->classificationRules;
        $last = array_pop($rules);
        $expr = '"'.$last['name'].'"';
        foreach (array_reverse($rules) as $rule) {
            $expr = "IF({$n}<={$rule['max']},\"{$rule['name']}\",{$expr})";
        }

        return "=IFERROR(IF(TRIM({$cell}&\"\")=\"\",\"\",{$expr}),\"؟\")";
    }

    /** يضيف ورقة مخفية بأسماء المدارس ويربطها كقائمة منسدلة لعمود «المدرسة». */
    private function addSchoolsDropdown(Worksheet $sheet): void
    {
        if ($this->schools === []) {
            return;
        }

        $spreadsheet = $sheet->getParent();
        $ref = $spreadsheet->createSheet();
        $ref->setTitle(self::SCHOOLS_SHEET);
        foreach (array_values($this->schools) as $i => $name) {
            $ref->setCellValue('A'.($i + 1), $name);
        }
        $ref->setSheetState(Worksheet::SHEETSTATE_HIDDEN);
        $spreadsheet->setActiveSheetIndex(0);

        $formula = "'".self::SCHOOLS_SHEET."'!\$A\$1:\$A\$".count($this->schools);
        $firstData = 4;
        for ($r = $firstData; $r <= $firstData + 199; $r++) {
            $sheet->getCell('A'.$r)->getDataValidation()
                ->setType(DataValidation::TYPE_LIST)
                ->setErrorStyle(DataValidation::STYLE_STOP)
                ->setAllowBlank(true)
                ->setShowDropDown(true)
                ->setShowErrorMessage(true)
                ->setErrorTitle('مدرسة غير صحيحة')
                ->setError('اختر مدرسة من القائمة')
                ->setFormula1($formula);
        }
    }
}
