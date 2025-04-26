import { chessGameText } from "@/constants/chess-game";
import { elementsIds } from "@/constants/elements-ids";
import { menuButtonsText } from "@/constants/menu";
import { test, expect } from "@playwright/test";

test("должна отображаться главная страница", async ({ page }) => {
    await page.goto("/");

    const aiButton = page.getByRole("button", {
        name: menuButtonsText.playWithAi,
    });
    await expect(aiButton).toBeVisible();

    const onlineButton = page.getByRole("button", {
        name: menuButtonsText.playOnline,
    });
    await expect(onlineButton).toBeVisible();

    const localButton = page.getByRole("link", {
        name: menuButtonsText.playWithFriend,
    });
    await expect(localButton).toBeVisible();
});

test("должна отображаться страница локальной игры", async ({ page }) => {
    await page.goto("/local");

    const chessBoard = page.locator(`div#${elementsIds.chessBoard}`);
    await expect(chessBoard).toBeVisible();

    const aiButton = page.getByRole("button", {
        name: chessGameText.undoButtonLabel,
    });
    await expect(aiButton).toBeVisible();

    const onlineButton = page.getByRole("button", {
        name: chessGameText.resetButtonLabel,
    });
    await expect(onlineButton).toBeVisible();
});

test("должна быть возможность создать онлайн-игру", async ({ page }) => {
    await page.goto("/");

    const createButton = page.getByRole("button", {
        name: menuButtonsText.playOnline,
    });
    await createButton.click();

    await page.waitForURL(
        /\/online\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/
    );
});
