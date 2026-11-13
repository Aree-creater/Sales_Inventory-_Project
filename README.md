# Smart Inventory & Sales Management System

A browser-based admin dashboard for managing products, making sales, and reviewing sales history. No backend, no framework, no build step.

## Features
- **Dashboard**: total products, sales revenue, completed orders, low-stock count, inventory cost value, top-selling product (all calculated from stored data).
- **Products**: add, edit, delete (with confirmation), search by ID or name, filter by category, sort by name, selling price or quantity, low-stock and out-of-stock badges, full validation.
- **New Sale**: cart with quantity controls, stock limits, live subtotal/discount/tax/grand total, safe checkout.
- **Sales History**: search by Sale ID, filter by date, full sale details.
- **Data tools**: remove sample data, clear all data (both with confirmation).
- Responsive layout (sidebar collapses on tablet/mobile, tables become cards on phones). All money is shown in PKR.

## Technologies
HTML5, CSS3, Vanilla JavaScript, browser `localStorage`.

## File Structure
```
index.html   page structure and dialogs
style.css    layout, theme, responsive rules
script.js    state, calculations, rendering, events, storage
README.md    this file
```

## How to Run (VS Code Live Server)
1. Open the project folder in VS Code.
2. Install the **Live Server** extension if needed.
3. Right-click `index.html` and choose **Open with Live Server**.

You can also double-click `index.html` to open it directly in a browser.

## How localStorage Works
- Products are saved under `sims.products` and sales under `sims.sales`.
- Data loads automatically on start and survives refreshes and browser restarts.
- Six sample products (tagged "sample") are added **only** when no product data exists yet. Saved data is never replaced by defaults.
- Corrupted or invalid entries are skipped safely and a warning is shown.
- Every change saves products and sales together. If saving fails, the change is rolled back.

## Discount and Tax Rules
```
Discount    = Subtotal × 10%        (only if Subtotal >= PKR 10,000)
Taxable     = Subtotal − Discount
Tax         = Taxable × 5%
Grand Total = Subtotal − Discount + Tax
```
Amounts are rounded to 2 decimals.

## Assumptions and Limitations
- Data lives in one browser on one device; clearing browser data removes it.
- The cart is kept in memory and is emptied on refresh.
- Sales store a snapshot of product names and prices, so history stays correct after products are edited or deleted.
- Changes made in another tab are not synced until the page is refreshed.
- There are no user accounts, returns/refunds, or export features.
