// The same test runs against both the healthy and deliberately broken fixture.
// Expected values come from the written test requirement, not from the page.
export class FunctionalCheckFailed extends Error {
  constructor(check, expected, actual) {
    super(`${check}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
    this.check = check; this.expected = expected; this.actual = actual;
  }
}

async function checkText(page, id, expected, label) {
  const element = page.locator(`#${id}`);
  await element.waitFor({ state: "visible" });
  const actual = (await element.innerText()).trim();
  if (actual !== expected) throw new FunctionalCheckFailed(label, expected, actual);
}

export async function runCheckoutFlow(page, url) {
  const origin = new URL(url).origin;
  if (new URL(url).hostname !== "127.0.0.1") throw new Error("This practice runner accepts only its owned loopback fixture.");
  await page.route("**/*", (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  page.setDefaultTimeout(3000);
  const response = await page.goto(url, { waitUntil: "load" });
  if (!response || response.status() !== 200) throw new Error("Practice page did not load successfully.");
  await page.getByRole("button", { name: "Add notebook", exact: true }).click();
  await page.getByRole("button", { name: "Add notebook", exact: true }).click();
  await checkText(page, "cart-count", "2", "Cart quantity");
  await page.getByRole("button", { name: "Open checkout", exact: true }).click();
  await checkText(page, "quantity", "2", "Checkout quantity");
  await checkText(page, "total", "$20.00", "Checkout total");
  await page.getByRole("button", { name: "Create demo order", exact: true }).click();
  await checkText(page, "order-id", "DEMO-ORDER-001", "Demo confirmation");
}
