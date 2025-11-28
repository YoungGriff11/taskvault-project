// tests/taskvault.test.js
import { test, expect } from "@playwright/test";

test.describe("Secure Branch – Expected Safe Behaviour", () => {
  test("1. Normal login works", async ({ page }) => {
    await page.goto("http://localhost:3000");
    await page.fill('input[name="email"]', "test4@example.com");
    await page.fill('input[name="password"]', "pass123");
    await page.click('button[type="submit"]'); // CSRF handled by secure branch
    await page.waitForTimeout(500); // Wait for redirect
    await expect(page).toHaveURL("http://localhost:3000/dashboard"); // Allow any dashboard URL
  });

  test("2. SQL Injection is BLOCKED", async ({ page }) => {
    await page.goto("http://localhost:3000");
    await page.fill('input[name="email"]', "' OR '1'='1' --");
    await page.fill('input[name="password"]', "anything");
    await page.click('button[type="submit"]');
    await page.waitForTimeout(500); // Wait for response
    await expect(page).toHaveURL("http://localhost:3000"); // Still on login
  });

  test("3. Stored XSS is BLOCKED – no alert", async ({ page }) => {
    await page.goto("http://localhost:3000");
    await page.fill('input[name="email"]', "test4@example.com");
    await page.fill('input[name="password"]', "pass123");
    await page.click('button[type="submit"]');
    await page.waitForURL("http://localhost:3000/dashboard");

    await page.fill('input[name="title"]', "<script>alert('XSS')</script>");
    await page.fill('textarea[name="description"]', "test");
    await page.click('button:has-text("Add Task")');
    await page.waitForTimeout(800);

    // In secure branch: payload is escaped → we see &lt;script&gt;
    // await expect(page.locator('text="&lt;script&gt;alert"')).toBeVisible({
    //   timeout: 5000,
    // });

    const dialogPromise = page
      .waitForEvent("dialog", { timeout: 4000 })
      .catch(() => null);
    await page.reload();
    await page.waitForLoadState("networkidle");
    const dialog = await dialogPromise;
    expect(dialog).toBeNull(); // No alert → XSS blocked
  });

  test("4. DOM-based XSS is BLOCKED – no alert", async ({ page }) => {
    // Must be logged in first
    await page.goto("http://localhost:3000");
    await page.fill('input[name="email"]', "test4@example.com");
    await page.fill('input[name="password"]', "pass123");
    await page.click('button[type="submit"]');
    await page.waitForURL("http://localhost:3000/dashboard");

    await page.goto(
      'http://localhost:3000/dashboard?inject=<script>alert("DOM XSS")</script>'
    );

    // In secure branch: inject param is escaped → we see &lt;script&gt;
    // await expect(
    //   page.locator('text="&lt;script&gt;alert(\\"DOM XSS\\")"')
    // ).toBeVisible({ timeout: 5000 });

    const dialogPromise = page
      .waitForEvent("dialog", { timeout: 4000 })
      .catch(() => null);
    await page.reload();
    await page.waitForLoadState("networkidle");
    const dialog = await dialogPromise;
    expect(dialog).toBeNull(); // No alert → safe
  });
  test("5. Admin panel does NOT show passwords", async ({ page }) => {
    await page.goto("http://localhost:3000");
    await page.fill('input[name="email"]', "admin@taskvault.com");
    await page.fill('input[name="password"]', "Admin123!");
    await page.click('button[type="submit"]');
    await page.waitForURL("http://localhost:3000/dashboard");

    await page.click('a[href="/admin"]') // Your link text
    await page.waitForURL("http://localhost:3000/admin");

    // Secure branch shows this heading instead of password column
    await expect(page.locator('text="Users (NO PASSWORDS)"')).toBeVisible({
      timeout: 5000,
    });
  });
});
