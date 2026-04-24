import { Injectable, signal } from '@angular/core';
import { PRICING_JSON } from './pricing.data';


const SECTION_LABELS: Record<string, string> = {
  'default': 'DEFAULT',
  'inserts': 'INSERTS',
  'fancy': 'FANCY',
  'hi_vis': 'HIGH VISIBILITY',
  'reflective': 'REFLECTIVE',
  'fancy_inserts': 'FANCY INSERTS',
  'fr': 'FIRE RESISTANT',
  'additional_charge': 'ADDITIONAL CHARGES'
};


export type CellValue = number | string;

export interface PricingRow {
  label: string;
  values: CellValue[];
}

export interface AdditionalCharge {
  name: string;
  type: string;   // 'fixed' | 'percentage' | 'size-tiered' | 'overcharge'
  display: string;
}

export interface PricingSection {
  key: string;
  label: string;
  columns: CellValue[];         
  rows: PricingRow[];
  discount: number;
  additionalCharges: AdditionalCharge[];
  isOpen: boolean;
}

@Injectable({ providedIn: 'root' })
export class PricingService {
  private _sections = signal<PricingSection[]>(this.parse());
  readonly sections = this._sections.asReadonly();

  private parse(): PricingSection[] {
    const rui = (PRICING_JSON.data.embroidered_specials as any).rui;
    const result: PricingSection[] = [];

    // Flat sections: one Price row, columns = item_tier
    const flatKeys = ['default', 'inserts', 'fancy', 'hi_vis', 'reflective', 'fancy_inserts'];
    for (const key of flatKeys) {
      if (!rui[key]) continue;
      const d = rui[key];
      result.push({
        key,
        label: SECTION_LABELS[key] ?? key.replace(/_/g, ' ').toUpperCase(),
        columns: [...d.item_tier],
        rows: [{ label: 'Price', values: [...d.price] }],
        discount: d.discount ?? 0,
        additionalCharges: [],
        isOpen: key === 'default'  
      });
    }

    if (rui.fr) {
      result.push({
        key: 'fr',
        label: SECTION_LABELS['fr'] ?? 'fr'.replace(/_/g, ' ').toUpperCase(),
        columns: [...rui.fr.item_tier],
        rows: rui.fr.size_tier.map((s: any) => ({
          label: `${s.size}"`,
          values: [...s.price]
        })),
        discount: rui.fr.discount ?? 0,
        additionalCharges: parseAdditionalCharges(rui.fr.additional_charge),
        isOpen: false
      });
    }

    // Top-level additional_charge section (no table, charges only)
    if (rui.additional_charge) {
      result.push({
        key: 'additional_charge',
        label: 'ADDITIONAL CHARGE',
        columns: [],
        rows: [],
        discount: 0,
        additionalCharges: parseAdditionalCharges(rui.additional_charge),
        isOpen: false
      });
    }

    return result;
  }

  toggleSection(key: string): void {
    this._sections.update(sections =>
      sections.map(s => s.key === key ? { ...s, isOpen: !s.isOpen } : s)
    );
  }

  updateCell(sectionKey: string, ri: number, ci: number, value: CellValue): void {
    this._sections.update(sections =>
      sections.map((s: PricingSection) => {
        if (s.key !== sectionKey) return s;
        return {
          ...s,
          rows: s.rows.map((row: PricingRow, rowI: number) => {
            if (rowI !== ri) return row;
            const values = [...row.values];
            values[ci] = value;
            return { ...row, values };
          })
        };
      })
    );
  }

  updateDiscount(sectionKey: string, value: number): void {
    this._sections.update(sections =>
      sections.map((s: PricingSection) =>
        s.key === sectionKey ? { ...s, discount: value } : s
      )
    );
  }

  addColumn(sectionKey: string, qty: number): void {
    this._sections.update(sections =>
      sections.map((s: PricingSection) => {
        if (s.key !== sectionKey) return s;
        return {
          ...s,
          columns: [...s.columns, qty],
          rows: s.rows.map((row: PricingRow) => ({ ...row, values: [...row.values, 0] }))
        };
      })
    );
  }

  removeColumn(sectionKey: string, colIndex: number): void {
    this._sections.update(sections =>
      sections.map((s: PricingSection) => {
        if (s.key !== sectionKey) return s;
        return {
          ...s,
          columns: s.columns.filter((_: CellValue, i: number) => i !== colIndex),
          rows: s.rows.map((row: PricingRow) => ({
            ...row,
            values: row.values.filter((_: CellValue, i: number) => i !== colIndex)
          }))
        };
      })
    );
  }
}


function formatName(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
}

function parseAdditionalCharges(charges: Record<string, any>): AdditionalCharge[] {
  const result: AdditionalCharge[] = [];
  for (const [key, val] of Object.entries(charges)) {
    const name = formatName(key);
    if (key === 'size' && val.size_tier && val.percentage) {
      result.push({ name: 'Size Surcharge', type: 'size-percentage', display: ` ${val.percentage[0]}% (>16sq), ${val.percentage[1]}% (>25sq), Quote (>60sq)` });
    } else if ('percentage' in val && typeof val.percentage === 'number') {
      result.push({ name, type: 'percentage', display: `₹${val.percentage}%` });
    } else if ('price' in val && !Array.isArray(val.price)) {
      result.push({ name, type: 'fixed', display: `₹${val.price}` });
    } else if ('price' in val && Array.isArray(val.price) && val.size_tier) {
      const pairs = (val.size_tier as number[]).map((t: number, i: number) => `₹${val.price[i]} (≤${t}sq)`).join(' · ');
      result.push({ name, type: 'size-tiered', display: pairs });
    } else if ('over' in val && 'price' in val) {
      const desc = val.every
        ? `₹${val.price} per ${val.every} stitches over ${val.over}`
        : `₹${val.price} per unit over ${val.over}`;
      result.push({ name, type: 'overcharge', display: desc });
    }
  }
  return result;
}