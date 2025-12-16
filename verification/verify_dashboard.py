
from playwright.sync_api import Page, expect, sync_playwright
import time

def test_dashboard_interaction(page: Page):
    # 1. Login
    page.goto("http://localhost:5173/login")
    if "setup" in page.url:
        print("Redirected to setup...")

    page.fill('input[name="email"]', 'admin')
    page.fill('input[name="password"]', '123')
    page.click('button[type="submit"]')

    page.wait_for_url("http://localhost:5173/", timeout=10000)
    expect(page.get_by_text("Dashboard")).to_be_visible()
    time.sleep(2)

    # 2. Verify Dashboard Modal (Click on Total Value KPI)
    print("Clicking KPI Card...")
    # Using a more robust locator for the clickable card (StatCard wrapper or title)
    # The StatCard has onClick.
    # Text: "Valor Contábil Total"
    page.locator("div").filter(has_text="Valor Contábil Total").last.click()

    # Expect Modal to open
    expect(page.get_by_text("Detalhe Valor Total")).to_be_visible(timeout=5000)
    print("Modal Opened.")

    # Close Modal
    print("Closing Modal...")
    page.keyboard.press("Escape")
    time.sleep(1)

    # 3. Verify Macro View Navigation
    print("Navigating to Macro View...")
    page.goto("http://localhost:5173/dashboard/detalhes/filial/Matriz")

    # 4. Verify Macro View Page
    expect(page.get_by_text("Filial: Matriz")).to_be_visible(timeout=10000)
    expect(page.get_by_text("Visão Detalhada e Analítica")).to_be_visible()

    # Screenshot Macro View
    page.screenshot(path="verification/macro_view.png")
    print("Macro View Verified.")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            test_dashboard_interaction(page)
            print("Verification script finished successfully.")
        except Exception as e:
            print(f"Verification failed: {e}")
            page.screenshot(path="verification/failure.png")
        finally:
            browser.close()
