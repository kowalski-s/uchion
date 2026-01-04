import { test, expect } from '@playwright/test'

test.describe('Homepage', () => {
  test('should load the homepage', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/УчиОн/)
  })

  test('should display navigation elements', async ({ page }) => {
    await page.goto('/')

    // Check if main content is visible
    await expect(page.locator('body')).toBeVisible()
  })

  test.skip('should navigate to generate page', async ({ page }) => {
    await page.goto('/')

    // TODO: Update selectors based on actual UI
    // Example: await page.click('text=Создать лист')
    // await expect(page).toHaveURL(/\/generate/)
  })

  test.skip('should handle form submission', async ({ page }) => {
    await page.goto('/')

    // TODO: Implement form interaction test
    // Example:
    // await page.selectOption('[name="subject"]', 'math')
    // await page.selectOption('[name="grade"]', '2')
    // await page.fill('[name="topic"]', 'Сложение')
    // await page.click('button[type="submit"]')
  })
})
