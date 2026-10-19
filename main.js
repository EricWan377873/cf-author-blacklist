// ==UserScript==
// @name         CF 拉黑出题人
// @namespace    https://codeforces.com/
// @version      1.0.0
// @description  自动移除比赛列表中含有指定出题人的整行；在指定比赛列表中命中时返回总比赛列表。支持筛选结果动态更新。
// @author       GPT-6
// @match        https://codeforces.com/contests*
// @match        https://www.codeforces.com/contests*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // ===== 拉黑名单：在这里添加 Codeforces 用户名 =====
    const BLACKLIST = [
        'chromate00',
        'Proof_by_QED',
        // '另一个出题人的用户名',
    ];
    // ====================================================

    const blocked = new Set(
        BLACKLIST.map(name => name.trim().toLowerCase())
    );

    const HOME = 'https://codeforces.com/contests';

    // /contests/2261 或 /contests/2261,2262 等指定比赛列表。
    // /contests 和 /contests/page/2 等普通列表只隐藏行，不跳转。
    const specificList =
        /^\/contests\/\d+(?:,\d+)*(?:\/page\/\d+)?\/?$/
        .test(location.pathname);

    function getWritersColumn(table) {
        // 只匹配真正的比赛表（Name + Writers 表头），
        // 不误伤其他表格。
        for (const row of Array.from(table.rows).slice(0, 5)) {
            const headers = Array.from(row.cells).map(
                cell => cell.textContent.trim()
            );

            const writersIndex = headers.findIndex(
                text => /^(writers?|authors?)$/i.test(text)
            );

            const nameIndex = headers.findIndex(
                text => /^name$/i.test(text)
            );

            if (writersIndex !== -1 && nameIndex !== -1) {
                return writersIndex;
            }
        }

        return -1;
    }

    function containsBlockedWriter(cell) {
        // 优先按出题人主页链接精确匹配。
        // 避免比赛标题等地方出现同名时误判。
        for (const link of cell.querySelectorAll('a[href*="/profile/"]')) {
            const match = (link.getAttribute('href') || '')
                .match(/\/profile\/([^/?#]+)/i);

            const handle = match
                ? decodeURIComponent(match[1])
                : link.textContent.trim();

            if (blocked.has(handle.toLowerCase())) {
                return true;
            }
        }

        // 兼容没有个人主页链接、
        // 仅以纯文本显示出题人昵称的情况。
        return cell.textContent
            .split(/[\s,，;；|、]+/)
            .some(name => blocked.has(name.toLowerCase()));
    }

    function scanContests() {
        for (const table of document.querySelectorAll('table')) {
            const writersIndex = getWritersColumn(table);

            if (writersIndex < 0) {
                continue;
            }

            for (const row of Array.from(table.rows)) {
                const writersCell = row.cells[writersIndex];

                if (!writersCell ||
                    !containsBlockedWriter(writersCell)) {
                    continue;
                }

                if (specificList) {
                    // 指定比赛列表：
                    // 命中任意一场就返回总比赛列表。
                    location.replace(HOME);
                    return;
                }

                // 总列表、分页和筛选结果：
                // 删除整场比赛所在的行。
                row.remove();
            }
        }
    }

    let scheduled = false;

    function scheduleScan() {
        if (scheduled) {
            return;
        }

        scheduled = true;

        setTimeout(() => {
            scheduled = false;
            scanContests();
        }, 50);
    }

    function start() {
        // 筛选器/AJAX 更新比赛表时重新检查。
        // 添加节点和修改文字都会触发。
        new MutationObserver(scheduleScan).observe(
            document.documentElement,
            {
                childList: true,
                subtree: true,
                characterData: true,
            }
        );

        scheduleScan();
    }

    if (document.documentElement) {
        start();
    } else {
        document.addEventListener(
            'DOMContentLoaded',
            start,
            { once: true }
        );
    }

    window.addEventListener('pageshow', scheduleScan);
})();
