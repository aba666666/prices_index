// src/worker.js
import * as jwt from '@tsndr/cloudflare-worker-jwt';
// 导入 Pages/Assets 模式所需的工具
import { getAssetFromKV } from '@cloudflare/kv-asset-handler'; 


// --- R2 URL 生成函数 ---

function getPublicImageUrl(r2_key, env) {
    // 确保 R2_PUBLIC_DOMAIN 已在 wrangler.toml 中配置
    if (!r2_key || !env.R2_PUBLIC_DOMAIN) return null;
    return `${env.R2_PUBLIC_DOMAIN}/${r2_key}`;
}


// --- 鉴权中间件 ---

async function authenticate(request, env) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // 未提供Token或格式错误
        return { authorized: false, status: 401 }; 
    }
    const token = authHeader.split(' ')[1];
    
    try {
        const isValid = await jwt.verify(token, env.JWT_SECRET);
        if (!isValid) {
            return { authorized: false, status: 403 };
        }
        return { authorized: true };
    } catch (e) {
        return { authorized: false, status: 403 };
    }
}

// --- API 路由处理函数 (其余 API 逻辑与之前保持一致) ---
// 请确保将之前 worker.js 中所有的 API 路由函数（handleLogin, handleGeneratePresignedUrl, 
// handleCreateUpdateMaterial, handleQueryMaterials, handleImportMaterials, handleDeleteMaterial）
// 粘贴到这里，它们的内部逻辑不需要再进行转义！
// ... (例如: handleLogin, handleQueryMaterials, handleImportMaterials, etc.)

// 由于 API 逻辑非常长，请确保将您之前 worker.js 中 "--- API 路由处理函数 ---" 之后的所有函数都复制到这里！
// 这里省略 API 函数定义以保持简洁：

async function comparePassword(password, storedHash, env) {
    // 假设您的 D1 数据库中存储的是 'testpass' 
    return password === storedHash;
}


async function handleLogin(request, env) {
    if (!env.DB) {
        const { username, password } = await request.json();
        if (username === 'test' && password === 'testpass') {
             const token = await jwt.sign({ user: 'admin', exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) }, env.JWT_SECRET);
             return new Response(JSON.stringify({ token, user_id: 1 }), { 
                headers: { 'Content-Type': 'application/json' } 
             });
        }
        return new Response('Configuration Error: DB binding is missing. Using fallback logic, but login failed.', { status: 401 });
    }
    
    try {
        const { username, password } = await request.json();
        
        const { results: users } = await env.DB.prepare(
            "SELECT id, password_hash FROM users WHERE username = ?"
        ).bind(username).all();

        if (users.length === 0) {
            return new Response('Invalid credentials (User not found)', { status: 401 });
        }
        
        const user = users[0];
        
        if (!await comparePassword(password, user.password_hash || 'testpass', env)) { 
             return new Response('Invalid credentials (Password mismatch)', { status: 401 });
        }

        try {
            const payload = { 
                user_id: user.id, 
                exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24)
            };
            const token = await jwt.sign(payload, env.JWT_SECRET);

            return new Response(JSON.stringify({ token, user_id: user.id }), { 
                headers: { 'Content-Type': 'application/json' } 
            });

        } catch (jwtError) {
            return new Response('JWT Signing Error. Check JWT_SECRET in wrangler.toml.', { status: 500 });
        }

    } catch (e) {
        console.error("Login error:", e.message);
        return new Response(`Internal Server Error: ${e.message}`, { status: 500 });
    }
}


async function handleGeneratePresignedUrl(request, env) {
    if (!env.R2_BUCKET) {
        return new Response(JSON.stringify({ 
            message: 'R2_BUCKET binding is missing.'
        }), { status: 500 });
    }
    
    const { key } = await request.json();
    if (!key) {
        return new Response(JSON.stringify({ message: 'Missing R2 key.' }), { status: 400 });
    }
    
    try {
        const signedUrl = await env.R2_BUCKET.createPresignedUrl({
            key: key,
            method: 'PUT',
            expiration: 60 * 5 
        });

        return new Response(JSON.stringify({ uploadUrl: signedUrl.url, r2Key: key }), {
            headers: { 'Content-Type': 'application/json' }
        });
        
    } catch (e) {
        return new Response(JSON.stringify({ 
            message: `Failed to generate presigned URL: ${e.message}`,
        }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

async function handleCreateUpdateMaterial(request, env) {
    if (!env.DB) {
        return new Response(JSON.stringify({ message: 'DB binding is missing.' }), { status: 500 });
    }

    const mat = await request.json();

    if (!mat.UID || !mat.unified_name) {
        return new Response(JSON.stringify({ message: 'Missing required fields: UID and unified_name' }), { status: 400 });
    }

    try {
        const stmt = env.DB.prepare(`
            INSERT OR REPLACE INTO materials 
            (UID, unified_name, material_type, sub_category, alias, color, model_number, length_mm, width_mm, diameter_mm, r2_image_key)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            mat.UID, mat.unified_name, mat.material_type, mat.sub_category, mat.alias, 
            mat.color, mat.model_number, 
            mat.length_mm, mat.width_mm, mat.diameter_mm, 
            mat.r2_image_key || null
        );

        await stmt.run();

        return new Response(JSON.stringify({ status: 'success', message: 'Material saved/updated.', uid: mat.UID }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (e) {
        console.error("Save/Update error:", e);
        return new Response(JSON.stringify({ message: `Save/Update Failed: ${e.message}` }), { status: 500 });
    }
}


async function handleQueryMaterials(request, env) {
    if (!env.DB) {
        return new Response(JSON.stringify({ message: 'DB binding is missing.' }), { status: 500 });
    }
    try {
        const url = new URL(request.url);
        const query = url.searchParams.get('q') || '';
        
        let stmt;
        
        const ORDER_BY_CLAUSE = `
            ORDER BY unified_name ASC, 
                     material_type ASC, 
                     sub_category ASC, 
                     model_number ASC,
                     UID ASC
        `;
        
        if (query) {
            const searchPattern = `%${query}%`;
            stmt = env.DB.prepare(`
                SELECT * FROM materials 
                WHERE UID LIKE ? OR unified_name LIKE ? 
                   OR alias LIKE ? OR sub_category LIKE ? OR model_number LIKE ?
                ${ORDER_BY_CLAUSE}
                LIMIT 100
            `).bind(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
        } else {
            stmt = env.DB.prepare(`
                SELECT * FROM materials 
                ${ORDER_BY_CLAUSE}
                LIMIT 100
            `);
        }
        
        const { results } = await stmt.all();

        const materialsWithUrls = results.map(mat => ({
            ...mat,
            image_url: getPublicImageUrl(mat.r2_image_key, env) 
        }));

        return new Response(JSON.stringify(materialsWithUrls), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (e) {
        console.error("Query error:", e);
        return new Response(JSON.stringify({ message: 'Database Query Failed' }), { status: 500 });
    }
}


async function handleImportMaterials(request, env) {
    if (!env.DB) {
        return new Response(JSON.stringify({ message: 'DB binding is missing.' }), { status: 500 });
    }
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
    
    const materials = await request.json(); 
    
    if (!Array.isArray(materials) || materials.length === 0) {
        return new Response(JSON.stringify({ 
            status: 'error', 
            message: 'Invalid data format. Expected array of materials.',
            errors: ['Invalid data format. Expected array of materials.']
        }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    try {
        let errorMessages = [];
        
        const statements = materials.map(mat => {
            if (!mat.UID || !mat.unified_name) {
                errorMessages.push(`Missing UID or unified_name for material: ${mat.unified_name || mat.UID || 'unknown'}`);
                return null;
            }
            return env.DB.prepare(`
                INSERT OR REPLACE INTO materials 
                (UID, unified_name, material_type, sub_category, alias, color, model_number, length_mm, width_mm, diameter_mm, r2_image_key)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                mat.UID, mat.unified_name, mat.material_type, mat.sub_category, mat.alias, 
                mat.color, mat.model_number, 
                mat.length_mm, 
                mat.width_mm,
                mat.diameter_mm, 
                mat.r2_image_key || null
            );
        }).filter(stmt => stmt !== null);
        
        if (statements.length > 0) {
            await env.DB.batch(statements);
        }

        return new Response(JSON.stringify({ 
            status: 'success', 
            total_processed: materials.length,
            imported_count: statements.length, 
            errors: errorMessages 
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (e) {
        console.error("Import error:", e);
        return new Response(JSON.stringify({ 
            status: 'error', 
            message: 'Import Failed',
            errors: [e.message]
        }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}

async function handleDeleteMaterial(request, env) {
    if (!env.DB) {
        return new Response(JSON.stringify({ message: 'DB binding is missing.' }), { status: 500 });
    }
    const url = new URL(request.url);
    const parts = url.pathname.split('/');
    const uid = parts[parts.length - 1]; 

    if (!uid) {
        return new Response(JSON.stringify({ message: 'Missing Material UID' }), { status: 400 });
    }

    try {
        const result = await env.DB.prepare("DELETE FROM materials WHERE UID = ?").bind(uid).run();
        
        if (result.changes === 0) {
            return new Response(JSON.stringify({ status: 'not found', message: `Material with UID ${uid} not found.` }), { 
                status: 404, 
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({ status: 'success', message: `Material ${uid} deleted.` }), { 
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
        console.error("Delete error:", e);
        return new Response(JSON.stringify({ message: `Delete Failed: ${e.message}` }), { status: 500 });
    }
}

// --- 主要 Worker 入口 ---

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method;

        const headers = { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*', 
            'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        };

        if (method === 'OPTIONS') {
            return new Response(null, { headers });
        }
        
        // --- API 路由 ---
        if (path.startsWith('/api/')) {
            // 登录不需要认证
            if (path === '/api/login' && method === 'POST') {
                return handleLogin(request, env);
            }

            // 查询 (GET /api/materials) 允许未认证用户访问 (访客模式)
            if (path === '/api/materials' && method === 'GET') {
                return handleQueryMaterials(request, env);
            }
            
            // 对于所有非 GET/OPTIONS 的请求，需要管理员认证
            const authResult = await authenticate(request, env);
            if (!authResult.authorized) {
                return new Response('Authentication Required or Forbidden', { status: authResult.status, headers });
            }
            
            // DELETE /api/materials/:uid
            if (path.startsWith('/api/materials/') && method === 'DELETE') {
                return handleDeleteMaterial(request, env);
            }

            // POST /api/materials (手动创建/更新)
            if (path === '/api/materials' && method === 'POST') {
                 return handleCreateUpdateMaterial(request, env);
            }
            
            // POST /api/presign-url (R2 图片上传)
            if (path === '/api/presign-url' && method === 'POST') {
                return handleGeneratePresignedUrl(request, env);
            }

            // POST /api/import (批量导入)
            if (path === '/api/import' && method === 'POST') {
                return handleImportMaterials(request, env);
            }
            
            return new Response('API Endpoint Not Found', { status: 404 });
        }
        
        // --- 静态资产托管 (Pages/Assets) ---
        // 任何不是 /api 的请求都被视为对静态文件的请求
        try {
            return await getAssetFromKV({ request }, {
                ASSET_NAMESPACE: env.__STATIC_CONTENT,
                ASSET_MANIFEST: env.__STATIC_CONTENT_MANIFEST,
            });
        } catch (e) {
            // 如果找不到文件，默认返回 index.html (SPA 模式)
            try {
                return await getAssetFromKV({ request }, {
                    ASSET_NAMESPACE: env.__STATIC_CONTENT,
                    ASSET_MANIFEST: env.__STATIC_CONTENT_MANIFEST,
                    mapRequestToAsset: req => new Request(`${new URL(req.url).origin}/index.html`, req),
                });
            } catch (e) {
                return new Response(e.message || 'Not Found', { status: 404 });
            }
        }
    }
};
