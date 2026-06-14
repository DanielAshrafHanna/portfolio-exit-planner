import { describe, expect, it } from "vitest";
import { formatChartSignedAxis, plChartDomain } from "./chartFormat";

describe("chartFormat", () => {
  it("uses compact axis labels without repeating EGP prefix", () => {
    expect(formatChartSignedAxis(1250.5, "EGP")).toBe("+1,250.5");
    expect(formatChartSignedAxis(-80, "USD")).toBe("-$80");
  });

  it("builds a padded profit and loss domain", () => {
    expect(plChartDomain([100, -50])).toEqual([-70, 120]);
    expect(plChartDomain([])).toEqual([-1, 1]);
  });
});
