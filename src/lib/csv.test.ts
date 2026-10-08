import { describe, expect, it } from 'vitest';
import { buildCsv } from './csv';

describe('buildCsv', () => {
  it('commence par un BOM, échappe et trie par date', () => {
    const csv = buildCsv(
      [
        {
          occurred_on: '2026-01-02',
          type: 'expense',
          category_id: 'a',
          amount: 3200000,
          note: 'Mũ, "nón"',
          created_at: '2',
        },
        {
          occurred_on: '2026-01-01',
          type: 'income',
          category_id: 'b',
          amount: 5,
          note: null,
          created_at: '1',
        },
      ],
      [
        { id: 'a', name: 'Quần áo' },
        { id: 'b', name: 'Lương' },
      ],
      {
        header: ['Ngày', 'Loại', 'Danh mục', 'Số tiền', 'Ghi chú'],
        expense: 'Chi tiêu',
        income: 'Thu nhập',
      },
    );
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.slice(1).trim().split('\r\n');
    expect(lines[0]).toBe('Ngày,Loại,Danh mục,Số tiền,Ghi chú');
    expect(lines[1]).toBe('2026-01-01,Thu nhập,Lương,5,');
    expect(lines[2]).toBe('2026-01-02,Chi tiêu,Quần áo,3200000,"Mũ, ""nón"""');
  });
});
