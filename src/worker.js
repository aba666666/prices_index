// src/worker.js
import * as jwt from '@tsndr/cloudflare-worker-jwt';

// --- 安全辅助函数 (生产环境推荐) ---

/**
 * ⚠️ 生产环境安全警告：
 * Cloudflare Workers 不直接支持 Node.js 的 'bcrypt'。
 * 最安全的方式是使用 Web Crypto API 实现 Scrypt 或 Argon2，或使用兼容 Worker 的库（如 argon2-browser）。
 * 为简化部署，这里提供一个使用 Web Crypto API 的简单 SHA-256 哈希作为“占位”，
 * 但请务必替换为更强的，如 Scrypt/Argon2。
 */

// ⚠️ 密码哈希占位：请替换为 Scrypt 或 Argon2 的实现
async function hashPassword(password) {
    // 实际生产中应使用 Scrypt/Argon2
    const encoder = new TextEncoder();
    const data = encoder.encode(password + env.PASSWORD_SALT); // 生产环境应使用 Salt
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ⚠️ 密码比较占位：请替换为 Scrypt 或 Argon2 的比较逻辑
async function comparePassword(password, storedHash, env) {
    // 实际生产中应使用 Scrypt/Argon2
    // 由于我们没有真正的 Argon2 库，这里简单比较 SHA-256 哈希值
    const inputHash = await hashPassword(password);
    return inputHash === storedHash;
}


// --- R2 URL 生成函数 ---

function getPublicImageUrl(r2_key, env) {
    if (!r2_key || !env.R2_PUBLIC_DOMAIN) return null;
    return `${env.R2_PUBLIC_DOMAIN}/${r2_key}`;
}


// --- 鉴权中间件 ---

async function authenticate(request, env) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
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
        // Token 解析失败或签名无效
        return { authorized: false, status: 403 };
    }
}

// --- API 路由处理函数 ---

async function handleLogin(request, env) {
    try {
        const { username, password } = await request.json();
        
        const { results: users } = await env.DB.prepare(
            "SELECT id, password_hash FROM users WHERE username = ?"
        ).bind(username).all();

        if (users.length === 0) {
            return new Response('Invalid credentials', { status: 401 });
        }
        
        const user = users[0];
        
        // ⚠️ 生产环境需替换为真正的比较函数
        // const isPasswordValid = await comparePassword(password, user.password_hash, env);
        // if (!isPasswordValid) {
        //     return new Response('Invalid credentials', { status: 401 });
        // }
        // 临时使用明文比较，生产环境必须更换！
        if (password !== user.password_hash) {
             return new Response('Invalid credentials (TEMP)', { status: 401 });
        }


        // JWT Payload: 包含用户ID和过期时间 (exp)
        const payload = { 
            user_id: user.id, 
            exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) // 24小时有效期
        };
        const token = await jwt.sign(payload, env.JWT_SECRET);

        return new Response(JSON.stringify({ token, user_id: user.id }), { 
            headers: { 'Content-Type': 'application/json' } 
        });

    } catch (e) {
        console.error("Login error:", e);
        return new Response('Internal Server Error', { status: 500 });
    }
}


async function handleQueryMaterials(request, env) {
    try {
        const url = new URL(request.url);
        const query = url.searchParams.get('q') || '';
        
        let stmt;
        
        if (query) {
            const searchPattern = `%${query}%`;
            // 模糊查询：UID, 统一名称, 别名, 小类
            stmt = env.DB.prepare(`
                SELECT * FROM materials 
                WHERE UID LIKE ? OR unified_name LIKE ? 
                   OR alias LIKE ? OR sub_category LIKE ?
                LIMIT 100
            `).bind(searchPattern, searchPattern, searchPattern, searchPattern);
        } else {
            // 默认查询
            stmt = env.DB.prepare("SELECT * FROM materials LIMIT 100");
        }
        
        const { results } = await stmt.all();

        // 附加图片URL
        const materialsWithUrls = results.map(mat => ({
            ...mat,
            image_url: getPublicImageUrl(mat.r2_image_key, env) 
        }));

        return new Response(JSON.stringify(materialsWithUrls), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (e) {
        console.error("Query error:", e);
        return new Response('Database Query Failed', { status: 500 });
    }
}


async function handleImportMaterials(request, env) {
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
    
    // 理论上这里应该解析 CSV，但为了简化，假设接收 JSON 数组
    const materials = await request.json(); 
    
    if (!Array.isArray(materials) || materials.length === 0) {
        return new Response('Invalid data format. Expected array of materials.', { status: 400 });
    }

    try {
        let errorMessages = [];
        
        // 使用 D1 的 Batch 模式提高性能
        const statements = materials.map(mat => {
            if (!mat.UID) {
                errorMessages.push(`Missing UID for material: ${mat.unified_name || 'unknown'}`);
                return null;
            }
            // 使用 INSERT OR REPLACE 实现批量导入和更新
            return env.DB.prepare(`
                INSERT OR REPLACE INTO materials 
                (UID, unified_name, material_type, sub_category, alias, color, model_number, length_mm, width_mm, diameter_mm, r2_image_key)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                mat.UID, mat.unified_name, mat.material_type, mat.sub_category, mat.alias, 
                mat.color, mat.model_number, mat.length_mm, mat.width_mm, mat.diameter_mm, mat.r2_image_key
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
        return new Response(`Import Failed: ${e.message}`, { status: 500 });
    }
}


// --- 主要 Worker 入口 ---

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method;

        // 设置 CORS headers
        const headers = { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*', // 生产环境请限制域名
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        };

        if (method === 'OPTIONS') {
            return new Response(null, { headers });
        }

        // 1. 公开路由 (登录)
        if (path === '/api/login' && method === 'POST') {
            return handleLogin(request, env);
        }
        
        // 2. 静态文件路由 (提供前端 HTML)
        if (path === '/' && method === 'GET') {
             // ⚠️ 生产环境建议使用 Cloudflare Pages 或 Workers Sites 托管静态资源
             // 这里仅作示例，如果使用 Workers 托管，需要读取并返回 frontend.html 的内容
             const htmlContent = '<h1>Frontend Page Placeholder</h1><p>Please access the API via /api/materials or /api/import after logging in at /api/login.</p>';
             return new Response(htmlContent, { headers: { 'Content-Type': 'text/html' } });
        }


        // 3. 保护路由 (所有其他 API)
        if (path.startsWith('/api/')) {
            const authResult = await authenticate(request, env);
            if (!authResult.authorized) {
                return new Response('Authentication Required or Forbidden', { status: authResult.status, headers });
            }

            // 路由分发 (已鉴权)
            if (path === '/api/materials' && method === 'GET') {
                return handleQueryMaterials(request, env);
            }
            if (path === '/api/import' && method === 'POST') {
                return handleImportMaterials(request, env);
            }
        }

        return new Response('Not Found', { status: 404 });
    }
};
