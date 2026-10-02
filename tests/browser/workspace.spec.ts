import {test,expect} from '@playwright/test';
test('unconfigured workspace is honest, private and mobile-safe',async({page})=>{
 const response=await page.goto('/projects');
 await expect(page.getByRole('heading',{name:'設定が必要です'})).toBeVisible();
 await expect(page.locator('input[name="name"]')).toHaveCount(0);
 expect(response?.headers()['cache-control']).toContain('no-store');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.screenshot({path:`/tmp/kg-task2-${test.info().project.name}-unconfigured.png`,fullPage:true});
});
test('direct detail and login routes do not impersonate an authenticated user',async({page})=>{
 await page.goto('/projects/11111111-1111-4111-8111-111111111111/papers/22222222-2222-4222-8222-222222222222');
 await expect(page.getByRole('heading',{name:'設定が必要です'})).toBeVisible();
 await expect(page.getByRole('button',{name:'変更を保存'})).toHaveCount(0);
 await page.goto('/login');await expect(page.getByRole('heading',{name:'設定が必要です'})).toBeVisible();await expect(page.locator('input[type="password"]')).toHaveCount(0);
});
test('synthetic graph demonstration remains separate from private workspace',async({page})=>{
 await page.goto('/demo');await expect(page.locator('.edge.solid')).toBeVisible();await page.getByRole('link',{name:'≤ 120°C'}).click();await expect(page.locator('.edge.dashed')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
test('isolated real form component: pending prevents double-submit and error retains draft',async({page})=>{
 await page.goto('http://127.0.0.1:3191');
 await page.getByLabel('タイトル',{exact:true}).fill('SYNTHETIC draft title');
 await page.getByLabel('掲載誌',{exact:true}).fill('SYNTHETIC journal');
 await page.getByLabel('出版年',{exact:true}).fill('2026');
 await page.getByLabel('メモ',{exact:true}).fill('SYNTHETIC unsaved note');
 const button=page.getByRole('button',{name:'論文を登録'});
 await button.click();
 await expect(page.getByRole('button',{name:'処理中…'})).toBeDisabled();
 await expect(page.getByRole('alert')).toContainText('SYNTHETIC conflict');
 await expect(page.getByLabel('タイトル',{exact:true})).toHaveValue('SYNTHETIC draft title');
 await expect(page.getByLabel('メモ',{exact:true})).toHaveValue('SYNTHETIC unsaved note');
 expect(await page.evaluate(()=>window.syntheticCalls)).toBe(1);
 expect(await page.evaluate(()=>window.syntheticValues.revision)).toBeUndefined();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.screenshot({path:`/tmp/kg-task2-${test.info().project.name}-forms.png`,fullPage:true});
});
