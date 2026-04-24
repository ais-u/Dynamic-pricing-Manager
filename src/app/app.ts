import { Component, inject, signal } from '@angular/core';
import { PricingService, CellValue } from './pricing.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  readonly pricing = inject(PricingService);

  // Tracks the "new column qty" input value per section key
  newColInputs = signal<Record<string, string>>({});

  getNewColInput(key: string): string {
    return this.newColInputs()[key] ?? '';
  }

  setNewColInput(key: string, value: string): void {
    this.newColInputs.update(inputs => ({ ...inputs, [key]: value }));
  }

  addColumn(sectionKey: string): void {
    const raw = this.getNewColInput(sectionKey);
    const qty = parseFloat(raw);
    if (isNaN(qty)) return;
    this.pricing.addColumn(sectionKey, qty);
    this.setNewColInput(sectionKey, '');
  }

  onCellInput(sectionKey: string, ri: number, ci: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const raw = input.value.trim();
    const num = parseFloat(raw);
    // Preserve string values like "dropout" if not a valid number
    const value: CellValue = isNaN(num) ? raw : num;
    this.pricing.updateCell(sectionKey, ri, ci, value);
  }

  onDiscountInput(sectionKey: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = parseFloat(input.value);
    if (!isNaN(val)) this.pricing.updateDiscount(sectionKey, val);
  }

  // Returns true for special string values like "dropout", "n/a"
  isSpecial(val: CellValue): boolean {
    return typeof val === 'string';
  }
}