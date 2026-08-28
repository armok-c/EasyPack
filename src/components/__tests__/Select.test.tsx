import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { describe, expect, it } from "vitest";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

describe("Select", () => {
  it("constrains the trigger, content, and item text for long values", () => {
    const longValue = "1".repeat(160);
    render(
      <Select open value={longValue} onValueChange={() => undefined}>
        <SelectTrigger aria-label="选择环境">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={longValue}>{longValue}</SelectItem>
        </SelectContent>
      </Select>,
    );

    expect(document.querySelector('[data-slot="select-trigger"]')).toHaveClass("min-w-0", "max-w-full");
    expect(document.querySelector('[data-slot="select-content"]')).toHaveClass(
      "min-w-0",
      "w-[var(--radix-select-trigger-width)]",
      "max-w-[var(--radix-select-content-available-width)]",
    );
    expect(document.querySelector('[data-slot="select-item-text"]')).toHaveClass("min-w-0", "flex-1", "truncate");
  });
});
