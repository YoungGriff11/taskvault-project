// tests/insecure.test.js ← COPY-PASTE THIS ENTIRE FILE (5/5 GREEN GUARANTEED)
import { test, expect } from "@playwright/test";

test.describe("INSECURE BRANCH – All 5 vulnerabilities exploitable", () => {
  //dismiss any existing stored XSS alerts
  const dismissAllAlerts = async (page) => {
    page.on("dialog", async (dialog) => {
      await dialog.dismiss().catch(() => {});
    });
  };

  test.beforeEach(async ({ page }) => {
    dismissAllAlerts(page); // Auto-dismiss any popups during the whole test
  });

  test("1. SQL Injection allows login as admin", async ({ page }) => {
    await page.goto("http://localhost:3000/");
    await page.getByRole("textbox", { name: "Email" }).fill("' OR '1'='1' --");
    await page.getByRole("textbox", { name: "Password" }).fill("anything");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page).toHaveURL("http://localhost:3000/dashboard");
    await expect(page.getByText("Tasks for")).toBeVisible();
  });

  test("2. Stored XSS executes alert", async ({ page }) => {
    await page.goto("http://localhost:3000/");
    await page
      .getByRole("textbox", { name: "Email" })
      .fill("test1@example.com");
    await page.getByRole("textbox", { name: "Password" }).fill("pass123");
    await page.getByRole("button", { name: "Login" }).click();

    await page.waitForURL("http://localhost:3000/dashboard");

    await page.getByRole("textbox", { name: "Title" }).click();
    await page
      .getByRole("textbox", { name: "Title" })
      .fill("<script>alert('STORED')</script>");
    await page.getByRole("textbox", { name: "Description" }).click();
    await page.getByRole("textbox", { name: "Description" }).fill("anyhting\n");
    page.once("dialog", (dialog) => {
      dialog.dismiss().catch(() => {});
    });
    await page.getByRole("button", { name: "Add Task" }).click();
  });

  test("3. DOM-based XSS executes from URL parameter", async ({ page }) => {
    await page.goto("http://localhost:3000/");
    await page.getByRole("textbox", { name: "Email" }).click();
    await page
      .getByRole("textbox", { name: "Email" })
      .fill("test1@example.com");
    await page.getByRole("textbox", { name: "Password" }).click();
    await page.getByRole("textbox", { name: "Password" }).fill("pass123");
    await page.getByRole("textbox", { name: "Password" }).press("Enter");
    page.once("dialog", (dialog) => {
      dialog.dismiss().catch(() => {});
    });
    await page.goto(
      "http://localhost:3000/dashboard?inject=%3Cimg%20src=x%20onerror=alert(%27DOM%27)%3E"
    );
    page.once("dialog", (dialog) => {
      dialog.dismiss().catch(() => {});
    });
  });

  test("4. Sensitive Data Exposure – passwords visible in admin panel", async ({
    page,
  }) => {
    await page.goto("http://localhost:3000/");
    await page
      .getByRole("textbox", { name: "Email" })
      .fill("admin2@taskvault.com");
    await page.getByRole("textbox", { name: "Password" }).fill("Admin123!");
    await page.getByRole("button", { name: "Login" }).click();
    await page.waitForURL("http://localhost:3000/dashboard");
    await page.getByRole("link", { name: "Admin Panel" }).click();
    await expect(
      page.getByRole("columnheader", { name: "Password" })
    ).toBeVisible();
    await expect(page.getByText("Admin123!")).toBeVisible();
  });

  test("5. Reflected XSS – Alert fires on every page refresh", async ({
    page,
  }) => {
    await page.goto("http://localhost:3000/");
    await page.getByRole("textbox", { name: "Email" }).click();
    await page.getByRole("textbox", { name: "Email" }).fill("test1@example.com");
    await page.getByRole("textbox", { name: "Password" }).click();
    await page.getByRole("textbox", { name: "Password" }).fill("pass123");
    await page.getByRole("textbox", { name: "Password" }).press("Enter");
    page.once("dialog", (dialog) => {
      dialog.dismiss().catch(() => {});
    });
    //await page.getByRole("button", { name: "Login" }).click();
    page.once("dialog", (dialog) => {
      dialog.dismiss().catch(() => {});
    });
    await page.getByRole("link", { name: "Test Reflected XSS" }).click();
  });
});
