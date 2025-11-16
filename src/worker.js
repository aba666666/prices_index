// src/worker.js
import * as jwt from '@tsndr/cloudflare-worker-jwt';

// --- 完整的内嵌前端 HTML/JS (已添加 CSV 导入和删除功能) ---
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
        h1 { color: #007bff; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
        #query-section, #auth-section, #import-section { 
            margin-bottom: 30px; 
            padding: 20px; 
            background-color: #fff;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
            border-radius: 8px;
        }
        input[type="text"], input[type="password"], input[type="file"] {
            padding: 10px;
            margin: 8px 0;
            width: 250px;
            border: 1px solid #ccc;
            border-radius: 4px;
        }
        button {
            padding: 10px 15px;
            margin: 5px;
            background-color: #28a745;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            transition: background-color 0.3s ease;
        }
        button.delete-btn {
            background-color: #dc3545;
        }
        button.delete-btn:hover {
            background-color: #c82333;
        }
        button:hover {
            background-color: #218838;
        }
        table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 20px; 
            table-layout: fixed;
        }
        th, td { 
            border: 1px solid #e0e0e0; 
            padding: 10px; 
            text-align: left; 
            word-wrap: break-word;
        }
        th { 
            background-color: #e9ecef; 
            font-weight: bold;
        }
        .material-img { 
            max-width: 50px; 
            max-height: 50px; 
            object-fit: cover;
            border-radius: 4px;
        }
        #login-status, #import-status {
            margin-top: 10px;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <h1>📚 小学教育材料统一数据库</h1>

    <div id="auth-section">
        <h2>🔑 用户登录</h2>
        <input type="text" id="username" value="test" placeholder="用户名">
        <input type="password" id="password" value="testpass" placeholder="密码">
        <button onclick="handleLogin()">登录</button>
        <p id="login-status" style="color: red;"></p>
    </div>
    
    <hr>
    
    <div id="main-section" style="display:none;">
        <button onclick="handleLogout()" style="float: right; background-color: #dc3545;">退出登录</button>
        
        <div id="import-section">
            <h2>📤 批量导入 (支持 CSV / JSON)</h2>
            <input type="file" id="import-file" accept=".json, .csv">
            <button onclick="handleImport()">解析并导入数据</button>
            <p id="import-status" style="color: blue;"></p>
            <p style="font-size: 0.9em; color: #666;">
                **CSV/JSON 字段要求：** 必须包含以下 11 个字段 (顺序不限，但推荐包含 UID 和 r2_image_key) <br>
                <code>UID</code>, <code>unified_name</code>, <code>material_type</code>, <code>sub_category</code>, <code>alias</code>, <code>color</code>, <code>model_number</code>, <code>length_mm</code>, <code>width_mm</code>, <code>diameter_mm</code>, <code>r2_image_key</code>
            </p>
        </div>

        <div id="query-section">
            <h2>🔍 材料查询与管理</h2>
            <input type="text" id="search-query" placeholder="输入名称、别名或小类进行查询" style="width: 400px;">
            <button onclick="fetchMaterials()">查询</button>
            
            <table id="results-table">
                <thead>
                    <tr>
                        <th style="width: 5%;">图片</th>
                        <th style="width: 15%;">唯一识别码 (UID)</th>
                        <th style="width: 15%;">统一名称</th>
                        <th style="width: 15%;">小类/材质</th>
                        <th style="width: 15%;">型号/尺寸 (mm)</th>
                        <th style="width: 25%;">R2 Key (图片路径)</th>
                        <th style="width: 10%;">操作</th>
                    </tr>
                </thead>
                <tbody id="results-body">
                    </tbody>
            </table>
        </div>
    </div>

    <script>
        const API_BASE_URL = '/api'; 
        const FIELD_NAMES = ["UID", "unified_name", "material_type", "sub_category", "alias", "color", "model_number", "length_mm", "width_mm", "diameter_mm", "r2_image_key"];

        window.onload = function() {
            if (localStorage.getItem('jwtToken')) {
                document.getElementById('auth-section').style.display = 'none';
                document.getElementById('main-section').style.display = 'block';
                fetchMaterials(); 
            }
        };

        // --- CSV/JSON 文件解析和导入功能 ---

        /** 简单的 CSV 解析函数 */
        function parseCSV(csvText) {
            const lines = csvText.trim().split('\\n');
            if (lines.length === 0) return [];
            
            // 使用第一个非空行作为 Headers
            const headerLine = lines[0].split(',');
            const headers = headerLine.map(h => h.trim().replace(/['"]+/g, ''));
            const data = [];

            // 从第二行开始遍历数据
            for (let i = 1; i < lines.length; i++) {
                if (!lines[i].trim()) continue;

                // 简单的逗号分割，可能不适用于带逗号的字段
                const values = lines[i].split(','); 
                let item = {};

                // 尝试按头部名称匹配
                headers.forEach((header, index) => {
                    if (index < values.length) {
                        const key = header.toLowerCase().replace(/[^a-z0-9_]/g, ''); // 简化键名
                        
                        // 尝试将 CSV 头部与预定义字段匹配
                        const matchedField = FIELD_NAMES.find(f => f.toLowerCase() === key || f.toLowerCase().includes(key));
                        
                        if (matchedField) {
                             item[matchedField] = values[index].trim().replace(/['"]+/g, '');
                        }
                    }
                });

                // 如果按名称匹配失败或字段不全，则按顺序填充 (简化逻辑)
                if (Object.keys(item).length < 3) {
                    item = {};
                    FIELD_NAMES.forEach((field, index) => {
                        if (index < values.length) {
                             item[field] = values[index].trim().replace(/['"]+/g, '');
                        }
                    });
                }
                
                // 确保数字字段是数字
                ['length_mm', 'width_mm', 'diameter_mm'].forEach(key => {
                    if (item[key]) item[key] = parseFloat(item[key]);
                });
                
                data.push(item);
            }
            return data;
        }

        async function handleImport() {
            const fileInput = document.getElementById('import-file');
            const status = document.getElementById('import-status');
            const token = localStorage.getItem('jwtToken');

            if (!token) {
                status.textContent = '请先登录。'; status.style.color = 'red'; return;
            }
            if (fileInput.files.length === 0) {
                status.textContent = '请选择一个 CSV 或 JSON 文件。'; status.style.color = 'red'; return;
            }

            const file = fileInput.files[0];
            const reader = new FileReader();

            reader.onload = async function (e) {
                try {
                    const content = e.target.result;
                    let materialsArray;
                    
                    if (file.name.toLowerCase().endsWith('.json')) {
                        materialsArray = JSON.parse(content);
                    } else if (file.name.toLowerCase().endsWith('.csv')) {
                        materialsArray = parseCSV(content);
                    } else {
                        status.textContent = '不支持的文件类型。'; status.style.color = 'red'; return;
                    }

                    if (!Array.isArray(materialsArray)) {
                        status.textContent = '文件内容错误：请确保是 JSON 数组或格式正确的 CSV。'; status.style.color = 'red'; return;
                    }

                    status.textContent = \`正在导入 \${materialsArray.length} 条数据...\`;
                    status.style.color = 'blue';

                    const response = await fetch(\`\${API_BASE_URL}/import\`, {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': \`Bearer \${token}\`
                        },
                        body: JSON.stringify(materialsArray)
                    });

                    const result = await response.json();

                    if (response.ok && result.status === 'success') {
                        status.textContent = \`导入成功！总计处理 \${result.total_processed} 条，导入/更新 \${result.imported_count} 条。\`;
                        status.style.color = 'green';
                        if (result.errors && result.errors.length > 0) {
                             status.textContent += \` (\${result.errors.length} 条记录处理失败)\`;
                        }
                        fetchMaterials();
                    } else {
                        status.textContent = \`导入失败: \${result.message || response.statusText}\`;
                        status.style.color = 'red';
                    }

                } catch (error) {
                    status.textContent = '文件解析或上传错误: ' + error.message;
                    status.style.color = 'red';
                }
            };

            reader.readAsText(file);
        }

        // --- 登录/退出功能 ---
        async function handleLogin() {
            // ... (与之前相同) ...
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const status = document.getElementById('login-status');
            status.textContent = '正在登录...';
            status.style.color = 'blue';

            try {
                const response = await fetch(\`\${API_BASE_URL}/login\`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                if (response.ok) {
                    const data = await response.json();
                    localStorage.setItem('jwtToken', data.token);
                    status.textContent = '登录成功！';
                    status.style.color = 'green';
                    
                    document.getElementById('auth-section').style.display = 'none';
                    document.getElementById('main-section').style.display = 'block';
                    fetchMaterials();
                } else {
                    status.textContent = '登录失败: ' + (await response.text() || response.statusText);
                    status.style.color = 'red';
                }
            } catch (error) {
                status.textContent = '网络错误，请检查 Worker 部署: ' + error.message;
                status.style.color = 'red';
            }
        }
        
        function handleLogout() {
            localStorage.removeItem('jwtToken');
            document.getElementById('main-section').style.display = 'none';
            document.getElementById('auth-section').style.display = 'block';
            document.getElementById('login-status').textContent = '已退出登录。';
            document.getElementById('login-status').style.color = 'green';
        }

        // --- 查询和删除功能 ---
        
        async function handleDelete(uid) {
            if (!confirm(\`确定要删除 UID 为 \${uid} 的材料记录吗？\n此操作不可逆！\u200C\)) return;

            const token = localStorage.getItem('jwtToken');
            try {
                const response = await fetch(\`\${API_BASE_URL}/materials/\${uid}\`, {
                    method: 'DELETE',
                    headers: { 'Authorization': \`Bearer \${token}\` }
                });

                if (response.ok) {
                    alert(\`记录 \${uid} 删除成功！\`);
                    fetchMaterials(); // 刷新列表
                } else if (response.status === 404) {
                    alert(\`删除失败：记录 \${uid} 未找到。\`);
                } else {
                    alert(\`删除失败: \${response.statusText}\`);
                }
            } catch (error) {
                alert('网络错误，删除失败。');
            }
        }

        async function fetchMaterials() {
            // ... (与之前相同) ...
            const query = document.getElementById('search-query').value;
            const token = localStorage.getItem('jwtToken');
            const body = document.getElementById('results-body');
            body.innerHTML = '<tr><td colspan="7" style="text-align: center;">正在查询...</td></tr>';
            
            if (!token) {
                body.innerHTML = '<tr><td colspan="7" style="color: red; text-align: center;">请先登录。</td></tr>';
                return;
            }

            try {
                const response = await fetch(\`\${API_BASE_URL}/materials?q=\${encodeURIComponent(query)}\`, {
                    headers: { 'Authorization': \`Bearer \${token}\` }
                });

                if (response.ok) {
                    const materials = await response.json();
                    renderMaterials(materials);
                } else if (response.status === 403 || response.status === 401) {
                    body.innerHTML = '<tr><td colspan="7" style="color: red; text-align: center;">权限过期，请重新登录。</td></tr>';
                    handleLogout();
                } else {
                    body.innerHTML = '<tr><td colspan="7" style="color: red; text-align: center;">查询失败: ' + response.statusText + '</td></tr>';
                }
            } catch (error) {
                body.innerHTML = '<tr><td colspan="7" style="color: red; text-align: center;">网络错误: ' + error.message + '</td></tr>';
            }
        }

        function renderMaterials(materials) {
            const body = document.getElementById('results-body');
            body.innerHTML = ''; 

            if (materials.length === 0) {
                body.innerHTML = '<tr><td colspan="7" style="text-align: center;">未找到匹配的材料。</td></tr>';
                return;
            }

            materials.forEach(mat => {
                const row = body.insertRow();
                
                let dimensions = '-';
                if (mat.diameter_mm) {
                    dimensions = \`Ø\${mat.diameter_mm}\`;
                } else if (mat.length_mm && mat.width_mm) {
                    dimensions = \`\${mat.length_mm} x \${mat.width_mm}\`;
                }
                
                // 图片单元格
                const imgCell = row.insertCell();
                if (mat.image_url) {
                    imgCell.innerHTML = \`<img src="\${mat.image_url}" class="material-img" alt="\${mat.unified_name}">\`;
                } else {
                    imgCell.textContent = '-';
                }
                
                // 仅显示关键信息，将图片Key和操作按钮放在一起
                row.insertCell().textContent = mat.UID;
                row.insertCell().textContent = mat.unified_name;
                row.insertCell().innerHTML = \`材质: \${mat.material_type || '-'} <br> 小类: \${mat.sub_category || '-'}\`;
                row.insertCell().innerHTML = \`型号: \${mat.model_number || '-'} <br> 尺寸: \${dimensions}\`;

                // R2 Key / 图片上传占位
                const r2KeyCell = row.insertCell();
                r2KeyCell.innerHTML = \`
                    <input type="text" value="\${mat.r2_image_key || ''}" style="width: 100%; font-size: 0.8em;" readonly>
                    <small>
                    * 实际上传功能需集成R2签名，此为路径占位。
                    </small>
                \`;

                // 操作按钮
                const actionsCell = row.insertCell();
                actionsCell.innerHTML = \`<button class="delete-btn" onclick="handleDelete('\${mat.UID}')">删除</button>\`;
                actionsCell.style.textAlign = 'center';
            });
        }
    </script>
</body>
</html>
`; 

// --- Worker 后端逻辑 ---

// ⚠️ 密码比较占位：用于生产环境，与 schema.sql 保持一致
async function comparePassword(password, storedHash, env) {
    return password === storedHash;
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
        return { authorized: false, status: 403 };
    }
}

// --- API 路由处理函数 ---

async function handleLogin(request, env) {
    if (!env.DB) {
        return new Response('Configuration Error: DB binding is missing.', { status: 500 });
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
        
        if (!await comparePassword(password, user.password_hash, env)) {
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


async function handleQueryMaterials(request, env) {
    try {
        const url = new URL(request.url);
        const query = url.searchParams.get('q') || '';
        
        let stmt;
        
        if (query) {
            const searchPattern = `%${query}%`;
            stmt = env.DB.prepare(`
                SELECT * FROM materials 
                WHERE UID LIKE ? OR unified_name LIKE ? 
                   OR alias LIKE ? OR sub_category LIKE ?
                LIMIT 100
            `).bind(searchPattern, searchPattern, searchPattern, searchPattern);
        } else {
            stmt = env.DB.prepare("SELECT * FROM materials LIMIT 100");
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
        return new Response('Database Query Failed', { status: 500 });
    }
}


async function handleImportMaterials(request, env) {
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
            if (!mat.UID) {
                errorMessages.push(`Missing UID for material: ${mat.unified_name || 'unknown'}`);
                return null;
            }
            return env.DB.prepare(`
                INSERT OR REPLACE INTO materials 
                (UID, unified_name, material_type, sub_category, alias, color, model_number, length_mm, width_mm, diameter_mm, r2_image_key)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                mat.UID, mat.unified_name, mat.material_type, mat.sub_category, mat.alias, 
                mat.color, mat.model_number, 
                parseFloat(mat.length_mm) || null, // 确保数字类型
                parseFloat(mat.width_mm) || null,
                parseFloat(mat.diameter_mm) || null, 
                mat.r2_image_key
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

// 新增：删除材料 API
async function handleDeleteMaterial(request, env) {
    const url = new URL(request.url);
    // 路径应该像 /api/materials/UID-12345
    const parts = url.pathname.split('/');
    const uid = parts[parts.length - 1]; 

    if (!uid) {
        return new Response(JSON.stringify({ message: 'Missing Material UID' }), { status: 400 });
    }

    try {
        // R2 删除逻辑 (可选, 略过以简化)
        
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

        // 设置 CORS headers
        const headers = { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*', 
            'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS', // 增加 DELETE
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        };

        if (method === 'OPTIONS') {
            return new Response(null, { headers });
        }

        // 1. 静态文件路由 (提供前端 HTML)
        if (path === '/' && method === 'GET') {
             return new Response(FRONTEND_HTML, { headers: { 'Content-Type': 'text/html' } });
        }

        // 2. 公开路由 (登录)
        if (path === '/api/login' && method === 'POST') {
            return handleLogin(request, env);
        }
        
        // 3. 保护路由 (所有其他 API)
        if (path.startsWith('/api/')) {
            const authResult = await authenticate(request, env);
            if (!authResult.authorized) {
                return new Response('Authentication Required or Forbidden', { status: authResult.status, headers });
            }
            
            // DELETE /api/materials/:uid
            if (path.startsWith('/api/materials/') && method === 'DELETE') {
                return handleDeleteMaterial(request, env);
            }

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
