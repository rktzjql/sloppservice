export const spacingChecks = [];
export async function auditSpacing(page, label) {
  const report = await page.evaluate(() => {
    const checks = [];
    const visible = (el) =>
      Boolean(
        el?.getBoundingClientRect().width &&
        el?.getBoundingClientRect().height &&
        getComputedStyle(el).visibility !== "hidden",
      );
    const test = (name, value, expected) =>
      checks.push({
        name,
        value: Math.round(value * 100) / 100,
        expected,
        passed: Math.abs(value - expected) <= 0.75,
      });
    const testMin = (name, value, expected) =>
      checks.push({
        name,
        value: Math.round(value * 100) / 100,
        expected,
        minimum: true,
        passed: value + 0.75 >= expected,
      });
    const gap = (a, b) =>
      b.getBoundingClientRect().top - a.getBoundingClientRect().bottom;
    const style = (el, key) => parseFloat(getComputedStyle(el)[key]);
    for (const [token, value] of Object.entries({
      "--space-1": 4,
      "--space-peer": 8,
      "--space-copy-list": 12,
      "--space-content": 16,
      "--space-section": 24,
      "--page-margin": 24,
      "--card-padding": 16,
      "--button-height": 56,
    }))
      test(
        "token " + token,
        parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue(token),
        ),
        value,
      );
    const main = document.querySelector(".page");
    if (visible(main)) {
      test("page-left", style(main, "paddingLeft"), 24);
      test("page-right", style(main, "paddingRight"), 24);
      const first = [...main.children].find(
        (e) => e.tagName !== "DIALOG" && visible(e),
      );
      const title = document.querySelector(".screen-head h1");
      if (first && visible(title))
        test("page-title-to-content", gap(title, first), 16);
    }
    const each = (selector, fn) =>
      document.querySelectorAll(selector).forEach((el) => {
        if (visible(el)) fn(el);
      });
    each(".aimi-button", (el) => {
      test("primary-height", el.getBoundingClientRect().height, 56);
      test("primary-radius", style(el, "borderTopLeftRadius"), 16);
    });
    each(
      ".today-card,.notice,.product,.current-character,.picker-list > button,.friend-list > button,.model-options button,.prompt-result,.inventory-grid button",
      (el) => {
        for (const edge of ["Top", "Right", "Bottom", "Left"])
          test(
            el.className + " padding" + edge,
            style(el, "padding" + edge),
            el.parentElement?.classList.contains("farm-inventory") ? 6 : 16,
          );
      },
    );
    each(
      ".reward-grid,.entry-list,.product-grid,.store-grid,.inventory-grid,.picker-list,.friend-list,.model-options,.tier-list,.metric-stack,.button-row,.dialog-actions",
      (el) => {
        test(el.className + " gap", style(el, "gap"), 8);
      },
    );
    each(".dialog-heading", (el) => {
      const popup = el.closest("dialog");
      for (const edge of ["Top", "Right", "Left"])
        test("popup-padding" + edge, style(popup, "padding" + edge), 16);
    });
    each(".dialog-actions", (el) => {
      const before = el.previousElementSibling;
      if (visible(before)) test("popup-body-to-CTA", gap(before, el), 24);
      const buttons = [...el.children].filter(visible);
      if (buttons.length === 2 && getComputedStyle(el).display === "grid")
        test("stacked-CTA-gap", gap(buttons[0], buttons[1]), 8);
    });
    each(".page > .aimi-button", (el) => {
      const before = el.previousElementSibling;
      if (visible(before) && before.tagName !== "DIALOG")
        test(
          "page-body-to-CTA",
          gap(before, el),
          before.classList.contains("aimi-button") ? 8 : 24,
        );
    });
    each(".notice > p", (el) => {
      const before = el.previousElementSibling;
      if (visible(before)) test("notice-title-description", gap(before, el), 8);
    });
    each(".page > .fixed-cta", (el) => {
      const before = el.previousElementSibling;
      if (visible(before))
        testMin(
          "body-to-CTA-minimum",
          gap(before, el.querySelector(".aimi-button")),
          24,
        );
    });
    each(".reward-dialog .dialog-body > h3", (el) =>
      test("tip-body-to-reward", gap(el.previousElementSibling, el), 24),
    );
    each(".reward-dialog .dialog-body > p.muted", (el) =>
      test("tip-reward-to-description", gap(el.previousElementSibling, el), 8),
    );
    each(".today-card", (el) => {
      const [small, strong, ...rows] = el.querySelectorAll("small,strong,span");
      test("home-kicker-title", gap(small, strong), 8);
      test("home-title-count", gap(strong, rows[0]), 12);
      test("home-count-record", gap(rows[0], rows[1]), 4);
      const bottom =
        el.getBoundingClientRect().bottom -
        rows[1].getBoundingClientRect().bottom;
      test("home-card-bottom-padding", bottom, 16);
    });
    each(".dialog-heading", (el) => {
      const title = el.querySelector("h2"),
        body = el.nextElementSibling,
        first = [...body.children].find(visible);
      if (first) {
        const popup = el.closest("dialog");
        const expected = popup.matches(".reward-dialog,.cleared-modal")
          ? 8
          : popup.matches(".game-result")
            ? 24
            : 16;
        test("popup-title-content", gap(title, first), expected);
      }
    });
    each('[data-screen="/mission"] > .notice + p', (el) =>
      test(
        "mission-status-description",
        gap(el.previousElementSibling, el),
        16,
      ),
    );
    each('[data-screen="/mission"] > .badge + h2', (el) =>
      test("mission-badge-heading", gap(el.previousElementSibling, el), 16),
    );
    each('[data-screen="/garden/edit"] > .button-row', (el) =>
      test("editor-body-actions", gap(el.previousElementSibling, el), 24),
    );
    each('[data-screen="/optimizer"] > .prompt-input + p', (el) =>
      test("field-counter", gap(el.previousElementSibling, el), 12),
    );
    each('[data-screen="/optimizer"] > .prompt-input + p + p', (el) =>
      test("counter-description", gap(el.previousElementSibling, el), 24),
    );
    return {
      checks,
      overflow: document.documentElement.scrollWidth > innerWidth,
    };
  });
  const row = {
    label,
    url: page.url(),
    viewport: page.viewportSize(),
    ...report,
  };
  spacingChecks.push(row);
  const failures = report.checks.filter((c) => !c.passed);
  if (report.overflow || failures.length)
    throw new Error(
      `Spacing ${label}: ${JSON.stringify({ overflow: report.overflow, failures })}`,
    );
  return row;
}
