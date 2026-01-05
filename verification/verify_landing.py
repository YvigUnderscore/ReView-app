from playwright.sync_api import sync_playwright

def verify_landing_page():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            # Navigate to the landing page
            # Assuming the frontend is running on default Vite port 5173 or the configured 3429
            # Based on memory, frontend is exposed on 3429 in Docker, but locally "npm run dev" usually starts on 5173.
            # I will check frontend_log.txt to confirm port if this fails, but I'll try 5173 first.
            # Actually, I should check the log first to be sure.

            # Wait a moment for server to start
            page.goto("http://localhost:5173")

            # Take a full page screenshot
            page.screenshot(path="verification/landing_page_full.png", full_page=True)

            # Take specific screenshot of the Hero section
            hero_section = page.locator("section").first
            hero_section.screenshot(path="verification/landing_page_hero.png")

            # Take screenshot of Roadmap
            roadmap_section = page.get_by_text("Roadmap", exact=True).locator("..").locator("..")
            roadmap_section.screenshot(path="verification/landing_page_roadmap.png")

            print("Screenshots captured successfully.")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_landing_page()
