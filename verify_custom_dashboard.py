
import os
import time
from playwright.sync_api import sync_playwright

def verify_custom_dashboard():
    print("[INFO] Starting Custom Dashboard Verification...")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1920, 'height': 1080})
        page = context.new_page()

        # Subscribe to console events
        page.on("console", lambda msg: print(f"PAGE LOG: {msg.text}"))
        page.on("pageerror", lambda exc: print(f"PAGE ERROR: {exc}"))

        # 1. Navigate to the Frontend
        print("[INFO] Navigating to http://localhost:5173/")
        try:
            page.goto("http://localhost:5173/", timeout=60000)
            page.wait_for_load_state("networkidle")
        except Exception as e:
            print(f"[ERROR] Failed to load page: {e}")

        # 2. Login
        try:
            # Check if we are already logged in (Dashboard title present)
            if page.locator("h1:has-text('Dashboard')").is_visible():
                print("[INFO] Already logged in.")
            else:
                email_input = page.locator("input[name='email']")
                if email_input.is_visible():
                    print("[INFO] Login page detected. Logging in...")
                    email_input.fill("admin")
                    page.fill("input[name='password']", "123")
                    page.click("button[type='submit']")

                    # Wait for either URL change or error
                    try:
                        page.wait_for_url("http://localhost:5173/", timeout=15000)
                        print("[INFO] Navigation successful.")
                    except:
                        print("[WARN] Navigation timeout. Checking current URL...")
                        print(f"Current URL: {page.url}")

                else:
                    print("[INFO] No login input and no Dashboard title.")
        except Exception as e:
            print(f"[ERROR] Login failed: {e}")

        # Screenshot regardless of success to see state
        page.screenshot(path="debug_state.png")

        # 3. Verify Edit Mode Button
        try:
            print("[INFO] Checking for 'Personalizar' button...")
            edit_btn = page.locator("button", has_text="Personalizar")
            if edit_btn.is_visible():
                print("[SUCCESS] 'Personalizar' button found.")
                edit_btn.click()
                time.sleep(2)
                page.screenshot(path="dashboard_edit_mode.png", full_page=True)
            else:
                print("[FAIL] 'Personalizar' button NOT found.")

        except Exception as e:
            print(f"[ERROR] Verification failed: {e}")

        browser.close()

if __name__ == "__main__":
    verify_custom_dashboard()
