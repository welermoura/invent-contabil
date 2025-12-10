
import os
import time
from playwright.sync_api import sync_playwright

def verify_dashboard():
    print("[INFO] Starting Dashboard Verification...")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1920, 'height': 1080})
        page = context.new_page()

        # 1. Navigate to the Frontend
        print("[INFO] Navigating to http://localhost:5173/")
        try:
            page.goto("http://localhost:5173/", timeout=60000)
            page.wait_for_load_state("networkidle")
        except Exception as e:
            print(f"[ERROR] Failed to load page: {e}")
            browser.close()
            return

        # 2. Check if we need to log in
        # We look for the email input. If it's there, we log in.
        # If it's not there, maybe we are already logged in (unlikely in incognito, but good for robustness)

        try:
            # Wait a moment for redirects to settle
            time.sleep(2)

            # Check for email input
            email_input = page.locator("input[name='email']")
            if email_input.is_visible():
                print("[INFO] Login page detected. Logging in...")
                email_input.fill("admin")
                page.fill("input[name='password']", "123")
                page.click("button[type='submit']")

                # Wait for navigation to complete
                page.wait_for_url("http://localhost:5173/", timeout=10000)
                page.wait_for_load_state("networkidle")
            else:
                print("[INFO] Login input not found. Assuming already logged in or stuck.")

        except Exception as e:
            print(f"[ERROR] Error during login flow: {e}")
            page.screenshot(path="error_login.png")

        # 3. Verify Dashboard Elements
        print("[INFO] Waiting for Dashboard to load...")
        try:
            # Look for "Valor Contábil" which is a key part of the new dashboard
            # Or the Dashboard title
            page.wait_for_selector("text=Dashboard Contábil", timeout=30000)
            print("[SUCCESS] 'Dashboard Contábil' title found.")

            # Check for KPIs
            if page.locator("text=Valor Contábil Total").is_visible():
                print("[SUCCESS] KPI 'Valor Contábil Total' found.")
            else:
                print("[FAIL] KPI 'Valor Contábil Total' NOT found.")

            # Check for Filters
            if page.locator("text=Filtros").is_visible():
                print("[SUCCESS] Filters bar found.")

            # Take a full page screenshot
            time.sleep(2) # Wait for animations
            page.screenshot(path="dashboard_full.png", full_page=True)
            print("[INFO] Screenshot saved to dashboard_full.png")

        except Exception as e:
            print(f"[ERROR] Dashboard verification failed: {e}")
            page.screenshot(path="error_dashboard.png")

        browser.close()

if __name__ == "__main__":
    verify_dashboard()
