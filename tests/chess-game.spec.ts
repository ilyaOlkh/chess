import { test, expect } from "@playwright/test";

test.describe("Функциональность шахматной игры", () => {
    test.fixme("должна позволять перемещать фигуры", async ({ page }) => {
        await page.goto("/local");

        await page.waitForSelector('div[role="table"]');

        const pawn = page
            .locator('[data-piece="pawn"][data-color="white"]')
            .first();

        const initialPosition = await pawn.getAttribute("data-position");

        await pawn.click();

        const targetSquare = page
            .locator("[data-square]")
            .filter({ has: page.locator('[data-highlight="move"]') })
            .first();
        await targetSquare.click();

        const newPawn = page
            .locator('[data-piece="pawn"][data-color="white"]')
            .first();
        const newPosition = await newPawn.getAttribute("data-position");

        expect(newPosition).not.toBe(initialPosition);
    });

    test.fixme("должна отображать взятые фигуры", async ({ page }) => {
        await page.goto("/local");

        await page
            .locator(
                '[data-piece="pawn"][data-color="white"][data-position="e2"]'
            )
            .click();
        await page.locator('[data-square="e4"]').click();

        // Ход черной пешкой e5
        await page
            .locator(
                '[data-piece="pawn"][data-color="black"][data-position="e7"]'
            )
            .click();
        await page.locator('[data-square="e5"]').click();

        // Ход белым конем на f3
        await page
            .locator(
                '[data-piece="knight"][data-color="white"][data-position="g1"]'
            )
            .click();
        await page.locator('[data-square="f3"]').click();

        // Ход черным конем на c6
        await page
            .locator(
                '[data-piece="knight"][data-color="black"][data-position="b8"]'
            )
            .click();
        await page.locator('[data-square="c6"]').click();

        // Белый конь берет пешку на e5
        await page
            .locator(
                '[data-piece="knight"][data-color="white"][data-position="f3"]'
            )
            .click();
        await page.locator('[data-square="e5"]').click();

        // Проверяем, что в области взятых фигур появилась черная пешка
        const capturedPiece = page.locator(
            '.captured-pieces [data-piece="pawn"][data-color="black"]'
        );
        await expect(capturedPiece).toBeVisible();
    });
});
