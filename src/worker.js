// src/worker.js
import * as jwt from '@tsndr/cloudflare-worker-jwt';

// --- 完整的内嵌前端 HTML/JS ---
// ⚠️ 注意：此变量必须包含您完整的 HTML/CSS/JS 脚本，否则首页将无法显示！
const FRONTEND_HTML = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>小学教育材料统一数据库 - 管理端</title>
    <style>
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            margin: 20px; 
            background-color: #f4f7f6;
            color: #333;
        }
        /* ... 其他 CSS 样式 ... */
    </style>
</head>
<body>
<script>
// ... 您的完整 JavaScript 脚本内容 ...
</script>
</body>
</html>
`;


// --- 核心认证和路由函数 ---

// 校验 Token
async function authenticate(request, env) {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const headers = { 'Content-Type': 'application/json' };

    if (!token) {
        return { authorized: false, status: 401 };
    }

    try {
        const isValid = await jwt.verify(token, env.JWT_SECRET);
        if (isValid) {
            return { authorized: true, status: 200 };
        }
    } catch (e) {
        // Token 验证失败
    }

    return { authorized: false, status: 403 };
}

// 登录处理
async function handleLogin(request, env) {
    const headers = { 'Content-Type': 'application/json' };
    const { username, password } = await request.json();

    // 使用硬编码的测试凭证
    if (username === 'test' && password === 'testpass') {
        const token = await jwt.sign({ user: 'admin', exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) }, env.JWT_SECRET);
        return new Response(JSON.stringify({ token }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ message: 'Invalid credentials' }), { status: 401, headers });
}

// R2 预签名 URL 生成 (逻辑已确认无误)
async function handleGeneratePresignedUrl(request, env) {
    const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
    
    // R2 BINDING DEBUG CHECK (用于确认绑定是否生效)
    if (!env.R2_BUCKET) {
        // 🚨 这一段代码返回了您反复看到的错误信息
        return new Response(JSON.stringify({ 
            message: 'R2_BUCKET binding is missing or failed.',
            debug: 'R2_BUCKET is null or undefined.'
        }), { status: 500, headers });
    }

    const { key } = await request.json();
    if (!key) {
        return new Response(JSON.stringify({ message: 'Missing R2 key.' }), { status: 400, headers });
    }
    
    try {
        // 核心功能：创建预签名 PUT URL
        const signedUrl = await env.R2_BUCKET.createPresignedUrl({
            key: key,
            method: 'PUT',
            expiration: 60 * 5 // 5分钟有效期
        });

        return new Response(JSON.stringify({ 
            uploadUrl: signedUrl.url, 
            r2Key: key, 
            publicDomain: env.R2_PUBLIC_DOMAIN 
        }), {
            status: 200, headers
        });
        
    } catch (e) {
        // 捕获 R2 绑定错误 (如果配置仍然失败)
        let debugInfo = `R2_BUCKET object type: ${typeof env.R2_BUCKET}. `;
        debugInfo += `Does it have createPresignedUrl? ${typeof env.R2_BUCKET.createPresignedUrl}`;
        
        return new Response(JSON.stringify({ 
            message: `Failed to generate presigned URL: ${e.message}`,
            debug: debugInfo
        }), { 
            status: 500, headers
        });
    }
}

// --- D1 CRUD 相关的处理函数 (占位符，请保留您本地的 D1 逻辑) ---
async function handleCreateUpdateMaterial(request, env) { 
    const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
    // 您的 D1 逻辑...
    return new Response(JSON.stringify({ message: 'Material updated/created successfully (D1 Placeholder)' }), { status: 200, headers });
}
async function handleDeleteMaterial(request, env) { 
    const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
    // 您的 D1 逻辑...
    return new Response(JSON.stringify({ message: 'Material deleted successfully (D1 Placeholder)' }), { status: 200, headers });
}
async function handleQueryMaterials(request, env) { 
    const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
    // 您的 D1 逻辑...
    return new Response(JSON.stringify({ data: [], message: 'Query successful (D1 Placeholder)' }), { status: 200, headers });
}
async function handleImportMaterials(request, env) { 
    const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
    // 您的导入逻辑...
    return new Response(JSON.stringify({ message: 'Import successful (D1 Placeholder)' }), { status: 200, headers });
}


// --- Worker Entrypoint ---
export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method;
        const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
        
        // 根路径处理 (解决 404 问题)
        if (path === '/') {
            return new Response(FRONTEND_HTML, { headers: { 'Content-Type': 'text/html' } });
        }

        if (path === '/api/login' && method === 'POST') {
            return handleLogin(request, env);
        }
        
        if (path.startsWith('/api/')) {
            // 1. 检查认证
            const authResult = await authenticate(request, env);
            if (!authResult.authorized) {
                return new Response('Authentication Required or Forbidden', { status: authResult.status, headers });
            }
            
            // 2. 认证通过后处理 API 接口
            
            // POST /api/presign-url (R2 Upload)
            if (path === '/api/presign-url' && method === 'POST') {
                return handleGeneratePresignedUrl(request, env);
            }
            
            // DELETE /api/materials/:uid
            if (path.startsWith('/api/materials/') && method === 'DELETE') {
                return handleDeleteMaterial(request, env);
            }

            // POST /api/materials (Manual Create/Update)
            if (path === '/api/materials' && method === 'POST') {
                 return handleCreateUpdateMaterial(request, env);
            }
            
            // GET /api/materials (Query)
            if (path === '/api/materials' && method === 'GET') {
                return handleQueryMaterials(request, env);
            }

            // POST /api/import (Bulk Import)
            if (path === '/api/import' && method === 'POST') {
                return handleImportMaterials(request, env);
            }
            
            // 如果
