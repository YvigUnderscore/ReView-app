from playwright.sync_api import sync_playwright, expect

def verify_admin_dashboard():
    # Token generated from backend/tests/get_token.js
    TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJhZG1pbkB0ZXN0LmNvbSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc2NzgyOTAwMn0.aFxC5WRNyfzKy7GysIvopncpxajr2cC8AIURJAKdAjY"

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        try:
            print("Navigating to app to inject token...")
            page.goto("http://localhost:5173/login")

            # Inject Token
            print("Injecting Token...")
            page.evaluate(f"localStorage.setItem('token', '{TOKEN}');")
            page.evaluate(f"localStorage.setItem('user', '{{\"id\":1,\"email\":\"admin@test.com\",\"role\":\"admin\",\"name\":\"Admin User\"}}');")

            # Navigate to Admin Dashboard
            print("Navigating to Admin Dashboard...")
            page.goto("http://localhost:5173/admin")
            page.wait_for_timeout(5000) # Wait for stats/socket

            # Check System Health Widget
            print("Checking System Health...")
            if page.get_by_text("System Health (Live)").is_visible():
                print("Found 'System Health (Live)'")
            else:
                print("System Health header NOT found")

            # Expect visible
            expect(page.get_by_text("System Health (Live)")).to_be_visible()

            # Check Recalculate Button
            print("Checking Recalculate Button...")
            recalc_btn = page.get_by_role("button", name="Recalculate Usage")
            expect(recalc_btn).to_be_visible()

            # Take Screenshot
            page.screenshot(path="frontend/verification/admin_dashboard.png", full_page=True)
            print("Screenshot saved.")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="frontend/verification/error.png")
            raise e
        finally:
            browser.close()

if __name__ == "__main__":
    verify_admin_dashboard()
