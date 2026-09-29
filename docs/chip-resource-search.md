# 芯片资料页检索链路

页面先调用现有 `/api/knowledge/shared`，只检索平台已发布正文。只有完整型号未命中时，才调用 `/api/chips/search` 搜索网页。两条路径均仅对管理员和开发者开放；网页搜索不写入知识库。

服务端复用管理页已保存的 DeepSeek 方案模型凭据，以 `deepseek-flash` 调用 DeepSeek Anthropic 兼容接口的云端 `web_search`。提示词参照“小智学长” `chip-resource-finder` Skill，要求查找产品页、数据手册/参考手册、SDK/工具。结果仅从 `web_search_tool_result` 的链接块提取，不使用模型生成文字中的 URL。按完整型号及 HTTPS 过滤，优先显示已识别的厂商域名，并把其他来源单独标记。无独立搜索服务或额外搜索 API Key，但搜索会消耗 DeepSeek 额度。

接口对每个用户限制为每分钟 3 次；请求中的 `max_uses` 设为 3，整体超时 30 秒。实际云端搜索次数由 DeepSeek 执行，需以账单为准。若 DeepSeek 未返回搜索工具结果，页面显示错误而不展示示例资料。搜索链接只作为线索，尚不逐页核验文档内容、提取引脚参数或生成器件档案；厂商归属及芯片适用范围仍需在原站核对。

依据：[DeepSeek Anthropic 兼容接口](https://api-docs.deepseek.com/guides/anthropic_api/)及[Anthropic Web Search 工具](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool)。DeepSeek Responses API 会忽略内置 `web_search`，因此此处使用其 Anthropic 兼容接口。
