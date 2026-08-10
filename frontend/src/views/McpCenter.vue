<script setup lang="ts">
/**
 * MCP 接入页：账号级 API Key 与 Cursor 配置说明。
 */
import AppTopbar from '/@/components/AppTopbar.vue';
import McpPanel from '/@/components/mcp/McpPanel.vue';
</script>

<template>
  <div class="mcp-page">
    <AppTopbar />

    <main class="content">
      <section class="page-heading">
        <div>
          <h1>MCP 接入</h1>
          <p>创建 API Key，一键复制提示词，让 Agent 帮你安装全局 MCP</p>
        </div>
      </section>
      <McpPanel />
    </main>
  </div>
</template>

<style scoped lang="scss">
.mcp-page {
  min-height: 100%;
  background:
    radial-gradient(circle at top left, rgba(99, 102, 241, 0.08), transparent 28%),
    radial-gradient(circle at top right, rgba(14, 165, 233, 0.08), transparent 24%),
    #f8fafc;
}

.content {
  max-width: 880px;
  margin: 0 auto;
  padding: 36px 24px 88px;
}

.page-heading {
  margin-bottom: 8px;

  h1 {
    margin: 0 0 8px;
    color: #0f172a;
    font-size: clamp(24px, 2.2vw, 30px);
    letter-spacing: -0.03em;
  }

  p {
    margin: 0;
    color: #64748b;
    font-size: 14px;
    line-height: 1.6;
  }
}
</style>
