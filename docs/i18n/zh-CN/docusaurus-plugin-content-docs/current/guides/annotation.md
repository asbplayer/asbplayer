---
sidebar_position: 1
---

import project from '@site/src/project';

# 字幕词汇标注 {#annotation}

asbplayer 可以为字幕添加标注，更好地辅助语言学习。字幕词汇标注功能包括：

- **单词样式**：根据单词状态设置颜色、下划线、轮廓等
    - 已知状态可以从 Anki、WaniKani 获取并同步，也可以在 asbplayer 中本地追踪（提供导入和导出功能，帮助录入已知单词）
- **读音标注**：在每个单词上方显示读音，或根据状态显示
- **词频标注**：在每个单词下方显示基于排名的词频，或根据状态显示（至少需要一本基于排名的词频词典）
- **音调标注**：在振假名或假名单词上显示音调模式（至少需要一本音调词典）
- **释义标注**：为每个单词显示简短释义或说明
- **统计和全文理解度估算**：展示当前媒体中已知单词的相关信息。
- **自适应播放**：利用播放模式和标注数据优化学习体验。
- **单词浏览器**：管理本地单词并查看从外部来源同步的单词。
- **未来还会推出更多功能！**

:::info
字幕词汇标注需要配置 [Yomitan](https://yomitan.wiki/) 实例和 [yomitan-api](https://github.com/yomidevs/yomitan-api)。

如果你依赖**本地词库**，建议安装 asbplayer 浏览器扩展，以减少浏览器删除已存单词的可能。如果无法安装扩展，可以定期导出设置和/或本地单词作为备份。
:::

## 设置 {#setup}

1. 打开 asbplayer **设置**。
2. 前往**字幕词汇标注**部分。
3. 选择要配置的轨道。
4. 为该轨道配置 **Yomitan URL**。
    - 你需要配置 [Yomitan](https://yomitan.wiki/) 实例和 [yomitan-api](https://github.com/yomidevs/yomitan-api)。
    - 如果 URL 无效或无法访问，asbplayer 会在该设置旁显示错误。
    - 要显示词频信息，你的 Yomitan 实例中至少要有一本基于排名的词频词典。
5. （Anki 用户）配置要从哪些卡片获取已知状态信息。
    - 通常应将 [`Anki 牌组`](../reference/settings.md#anki-decks)留空以使用所有牌组；一般只需按字段筛选。
    - [`Anki 单词字段`](../reference/settings.md#anki-word-fields)对应 Anki 笔记中只包含目标单词的字段。
    - 只有不含专用单词字段的 Anki 笔记（例如句子牌组）才应使用[`Anki 句子字段`](../reference/settings.md#anki-sentence-fields)。如果单词不在 Anki 单词字段中，这些单词会作为备用来源。
    - 配置这些字段后，使用[`重建 Anki 词库`](../reference/settings.md#re-build-anki-word-database)填充数据库。
6. （WaniKani 用户）前往 [WaniKani > 设置 > API 令牌](https://www.wanikani.com/settings/personal_access_tokens)为 asbplayer 创建令牌。
    - 在 `Token Description` 字段中输入 `asbplayer`，取消选中所有 `Permissions`；asbplayer 只需要读取 WaniKani 帐户的权限。
    - 点击 `Generate token`，然后将生成的令牌复制到 [`WaniKani API 令牌`](../reference/settings.md#wanikani-api-token)中。
    - 配置 API 令牌后，使用[`重建 WaniKani 词库`](../reference/settings.md#re-build-wanikani-word-database)填充数据库。
7. 为该轨道启用所需的标注功能（样式、读音、词频、音调等）。按需自定义其他设置。
8. 各选项的详细说明请参阅设置参考中的[字幕词汇标注](../reference/settings.md#annotation)部分。键盘操作列在[字幕词汇标注键盘快捷键](../reference/settings.md#annotation-keyboard-shortcuts)组中。

## 故障排除 {#troubleshooting}

字幕词汇标注问题的排查方法请参阅文档中的[常见问题](../common-issues.md#annotation)部分。如果那里没有解决方案，请在 <a href={project.urls.discord}>Discord</a> 上寻求帮助，或提交<a href={`${project.urls.repo}/issues`}>错误报告</a>，并详细说明问题及复现步骤。
