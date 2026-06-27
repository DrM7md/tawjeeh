<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithColumnWidths;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Cell\DataValidation;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\PageSetup;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/**
 * أساس تصدير Excel بتنسيق رسمي عربي (RTL) جاهز للطباعة:
 * صف عنوان + صف معلومات (العام/التاريخ) + رأس ملوّن + حدود + تجميد + فلترة + إعداد طباعة.
 */
abstract class FormalExport implements FromArray, WithColumnWidths, WithEvents, WithTitle
{
    /** ألوان الهوية. */
    protected string $brand = '0F766E';     // أخضر مزرقّ غامق
    protected string $brandDark = '134E4A'; // أغمق للرأس
    protected string $stripe = 'F1F5F9';    // تخطيط الصفوف الزوجية
    protected string $borderColor = 'CBD5E1';

    /** عنوان التقرير (يظهر في الصف الأول وفي اسم الورقة). */
    abstract protected function reportTitle(): string;

    /** أسماء الأعمدة. @return list<string> */
    abstract protected function columns(): array;

    /** صفوف البيانات. @return list<list<string|int|null>> */
    abstract protected function rows(): array;

    /** عرض الأعمدة. @return array<string,float> */
    abstract public function columnWidths(): array;

    /** سطر معلومات أسفل العنوان (مثل: العام الدراسي + تاريخ الإصدار). */
    protected function subtitle(): string
    {
        return '';
    }

    /**
     * قوائم منسدلة للتحقّق على أعمدة محدّدة (للقوالب) — توثيق ذاتي للقيم المسموحة.
     *
     * @return array<string,list<string>> حرف العمود => القيم المسموحة
     */
    protected function validations(): array
    {
        return [];
    }

    public function title(): string
    {
        return $this->reportTitle();
    }

    public function array(): array
    {
        $colCount = count($this->columns());

        $out = [
            $this->pad([$this->reportTitle()], $colCount), // 1: العنوان
            $this->pad([$this->subtitle()], $colCount),    // 2: المعلومات
            $this->columns(),                              // 3: الرأس
        ];

        foreach ($this->rows() as $row) {
            $out[] = $this->pad($row, $colCount);
        }

        return $out;
    }

    /** يضبط طول الصف ليطابق عدد الأعمدة. */
    private function pad(array $row, int $colCount): array
    {
        return array_pad(array_slice($row, 0, $colCount), $colCount, '');
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $sheet = $event->sheet->getDelegate();
                $this->decorate($sheet);
            },
        ];
    }

    protected function decorate(Worksheet $sheet): void
    {
        $colCount = count($this->columns());
        $lastCol = Coordinate::stringFromColumnIndex($colCount);
        $dataCount = count($this->rows());
        $headerRow = 3;
        $firstData = 4;
        $lastData = $headerRow + $dataCount; // آخر صف بيانات

        $sheet->setRightToLeft(true);
        $sheet->getParent()->getDefaultStyle()->getFont()->setName('Arial')->setSize(11);

        /* ===== العنوان (صف 1) ===== */
        $sheet->mergeCells("A1:{$lastCol}1");
        $sheet->getRowDimension(1)->setRowHeight(32);
        $sheet->getStyle('A1')->applyFromArray([
            'font' => ['bold' => true, 'size' => 16, 'color' => ['rgb' => 'FFFFFF']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $this->brand]],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
        ]);

        /* ===== المعلومات (صف 2) ===== */
        $sheet->mergeCells("A2:{$lastCol}2");
        $sheet->getRowDimension(2)->setRowHeight(20);
        $sheet->getStyle('A2')->applyFromArray([
            'font' => ['size' => 11, 'color' => ['rgb' => '475569']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $this->stripe]],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
        ]);

        /* ===== الرأس (صف 3) ===== */
        $sheet->getRowDimension($headerRow)->setRowHeight(28);
        $sheet->getStyle("A{$headerRow}:{$lastCol}{$headerRow}")->applyFromArray([
            'font' => ['bold' => true, 'size' => 11, 'color' => ['rgb' => 'FFFFFF']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $this->brandDark]],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER, 'wrapText' => true],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => 'FFFFFF']]],
        ]);

        /* ===== البيانات ===== */
        if ($dataCount > 0) {
            $range = "A{$firstData}:{$lastCol}{$lastData}";
            $sheet->getStyle($range)->applyFromArray([
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER, 'wrapText' => true],
                'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => $this->borderColor]]],
            ]);
            for ($r = $firstData; $r <= $lastData; $r++) {
                $sheet->getRowDimension($r)->setRowHeight(22);
                if (($r - $firstData) % 2 === 1) {
                    $sheet->getStyle("A{$r}:{$lastCol}{$r}")->getFill()
                        ->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('F8FAFC');
                }
            }
            // فلترة على الرأس + البيانات
            $sheet->setAutoFilter("A{$headerRow}:{$lastCol}{$lastData}");
        }

        /* ===== قوائم منسدلة للتحقّق (للقوالب) ===== */
        $validationLastRow = max($lastData, $firstData + 199); // مساحة لإضافة صفوف جديدة
        foreach ($this->validations() as $col => $options) {
            $formula = '"'.implode(',', $options).'"';
            for ($r = $firstData; $r <= $validationLastRow; $r++) {
                $dv = $sheet->getCell("{$col}{$r}")->getDataValidation();
                $dv->setType(DataValidation::TYPE_LIST)
                    ->setErrorStyle(DataValidation::STYLE_STOP)
                    ->setAllowBlank(true)
                    ->setShowDropDown(true)
                    ->setShowErrorMessage(true)
                    ->setErrorTitle('قيمة غير صحيحة')
                    ->setError('اختر قيمة من القائمة')
                    ->setFormula1($formula);
            }
        }

        /* ===== تجميد + إعداد الطباعة ===== */
        $sheet->freezePane("A{$firstData}");

        $setup = $sheet->getPageSetup();
        $setup->setOrientation(PageSetup::ORIENTATION_LANDSCAPE);
        $setup->setPaperSize(PageSetup::PAPERSIZE_A4);
        $setup->setFitToWidth(1);
        $setup->setFitToHeight(0);
        $setup->setRowsToRepeatAtTopByStartAndEnd(1, $headerRow);
        $sheet->getPageMargins()->setTop(0.5)->setBottom(0.6)->setLeft(0.3)->setRight(0.3);
        $sheet->setShowGridlines(false);

        $sheet->getHeaderFooter()->setOddFooter('&R&P / &N&L&D');
    }
}
