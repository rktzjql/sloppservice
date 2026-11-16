/** Inspect every visible text element and Chromium's actually rendered font faces. */
export const fontChecks = [];
export async function auditFonts(page, label) {
  await page.evaluate(async () => {
    await document.fonts.load('400 15px "AIMI UX"');
    await document.fonts.load('700 22px "AIMI UX"');
    await document.fonts.ready;
  });
  const items = await page.evaluate(() => {
    const result = [];
    for (const el of document.querySelectorAll("body *")) {
      if (!(el instanceof HTMLElement || el instanceof SVGElement)) continue;
      const text = [...el.childNodes]
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent)
        .join("")
        .trim();
      const input =
        el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
      if (!text && !input) continue;
      const st = getComputedStyle(el),
        rect = el.getBoundingClientRect();
      if (
        !rect.width ||
        !rect.height ||
        st.visibility === "hidden" ||
        st.display === "none"
      )
        continue;
      const id = String(result.length);
      el.setAttribute("data-font-audit", id);
      result.push({
        id,
        tag: el.tagName,
        text: (text || el.value || el.getAttribute("placeholder") || "").slice(
          0,
          90,
        ),
        family: st.fontFamily,
      });
    }
    return result;
  });
  const errors = items.filter((x) => !x.family.includes("AIMI UX"));
  const cdp = await page.context().newCDPSession(page);
  let rendered = 0;
  const faces = new Set();
  try {
    await cdp.send("DOM.enable");
    await cdp.send("CSS.enable");
    const { root } = await cdp.send("DOM.getDocument");
    const { nodeIds } = await cdp.send("DOM.querySelectorAll", {
      nodeId: root.nodeId,
      selector: "[data-font-audit]",
    });
    for (const nodeId of nodeIds) {
      const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", {
        nodeId,
      });
      for (const f of fonts) {
        if (!f.glyphCount) continue;
        rendered += f.glyphCount;
        faces.add(f.familyName);
        if (!f.isCustomFont || !/^AISlop(Regular|Bold)$/.test(f.familyName)) {
          const { attributes } = await cdp.send("DOM.getAttributes", {
            nodeId,
          });
          const idx = attributes.indexOf("data-font-audit");
          errors.push({
            element: items[Number(attributes[idx + 1])],
            renderedFont: f.familyName,
            custom: f.isCustomFont,
          });
        }
      }
    }
  } finally {
    await cdp.detach();
    await page.evaluate(() =>
      document
        .querySelectorAll("[data-font-audit]")
        .forEach((x) => x.removeAttribute("data-font-audit")),
    );
  }
  const result = {
    label,
    url: page.url(),
    elements: items.length,
    renderedGlyphs: rendered,
    faces: [...faces],
    errors,
  };
  fontChecks.push(result);
  if (errors.length)
    throw new Error(`Font audit ${label}: ${JSON.stringify(errors)}`);
  return result;
}
