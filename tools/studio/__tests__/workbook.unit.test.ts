import { it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { workbook } from '../exporters';
import { createDocument } from '../../../src/features/communication-studio/logic/templates';
it('keeps a campaign plan readable when a referenced page is no longer present', async () => {
  const doc = createDocument('single', 'Missing page');
  doc.posts[0].pageIds = ['removed'];
  const book = new ExcelJS.Workbook();
  await book.xlsx.load((await workbook(doc)) as any);
  expect(book.getWorksheet('Redaktionsplan')!.getCell('J3').text).toBe('');
});
it('exports all channels, dates and literal user text to Excel', async () => {
  const doc = createDocument('campaign', '=HYPERLINK("bad")', undefined, 8);
  doc.startDate = '2026-09-21';
  doc.posts[0].captions.instagram = '=1+1';
  const bytes = await workbook(doc);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(bytes as any);
  const plan = book.getWorksheet('Redaktionsplan')!;
  expect(plan.rowCount).toBe(122);
  expect(plan.getCell('F3').type).toBe(ExcelJS.ValueType.String);
  expect(book.getWorksheet('Kanaltexte')!.getCell('C2').value).toBe('=1+1');
  expect(plan.getCell('C3').formula).toContain('$B$1+B3');
  expect(book.getWorksheet('Auswertung')!.getCell('C2').value).toBeNull();
});
