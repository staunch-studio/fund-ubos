package org.logrum.ubos.web.console.dto;

import java.util.List;

// 使用 Java Record 接收前端参数
public record BatchCommitRequest(
    List<String> slugs,       // 要批量修改的实体标识
    String entityType,        // 前端需传，如 "LOGIC", "VIEW" (如果不传默认为 LOGIC)
    String branch,            // 分支，如 "master"
    String jsonPatch,         // 编辑器里的 JSON 内容
    String message            // 提交说明
) {}