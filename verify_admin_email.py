from playwright.sync_api import sync_playwright, expect
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 720})
        page = context.new_page()

        # Navigate to Login
        print("Navigating to Login...")
        page.goto("http://localhost:3429/login")

        # Check if we are actually on login page
        try:
            page.wait_for_selector("input[type='email']", timeout=5000)
        except:
            print("Login inputs not found. Dumping HTML:")
            print(page.content())
            page.screenshot(path="login_debug.png")
            raise

        print("Logging in...")
        page.fill("input[type='email']", "admin@example.com")
        page.fill("input[type='password']", "password123")
        page.click("button[type='submit']")

        # Wait for navigation
        page.wait_for_url("http://localhost:3429/", timeout=10000)

        # Navigate to Admin Dashboard
        print("Navigating to Admin Dashboard...")
        page.goto("http://localhost:3429/admin")

        # Take screenshot of whatever we see at /admin
        time.sleep(2)
        page.screenshot(path="frontend_verification.png", full_page=True)

        # Debug: Print page content if fail
        try:
            expect(page.get_by_role("heading", name="Admin Dashboard")).to_be_visible()
        except:
            print("Failed to find Admin Dashboard heading. Dumping page source:")
            print(page.content())
            page.screenshot(path="frontend_error.png")
            raise

        # Scroll to Email Configuration
        print("Verifying Test Email Button...")
        test_btn = page.get_by_text("Send Test Email")
        test_btn.scroll_into_view_if_needed()
        expect(test_btn).to_be_visible()

        # Verify Announcements section exists
        print("Verifying Announcements Section...")
        announcement_header = page.get_by_role("heading", name="Send Announcement / Newsletter")
        expect(announcement_header).to_be_visible()

        print("Verification successful!")
        browser.close()

if __name__ == "__main__":
    run()
