// src/worker.js
import * as jwt from '@tsndr/cloudflare-worker-jwt';

// --- 完整的内嵌前端 HTML/JS (新增了手动编辑和图片上传功能) ---
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
        #query-section, #auth-section, #import-section, #manual-section { 
            margin-bottom: 30px; 
            padding: 20px; 
            background-color: #fff;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
            border-radius: 8px;
        }
        input:not([type="file"]):not([type="checkbox"]):not([type="radio"]), select {
            padding: 8px;
            margin: 5px 0;
            width: 100%;
            box-sizing: border-box;
            border: 1px solid #ccc;
            border-radius: 4px;
        }
        .form-group {
            margin-bottom: 10px;
        }
        .form-row {
            display: flex;
            gap: 20px;
        }
        .form-row > div {
            flex: 1;
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
        button.delete-btn { background-color: #dc3545; }
        button.edit-btn { background-color: #ffc107; color: #333; }
        button:hover { background-color: #218838; }
        table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 20px; 
            table-layout: fixed;
        }
        th, td { 
            border: 1px solid #e0e0e0; 
            padding: 8px; 
            text-align: left; 
            word-wrap: break-word;
            font-size: 0.9em;
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
        .upload-controls {
            display: flex;
            gap: 5px;
            align-items: center;
        }
    </style>
</head>
<body>
    <h1>📚 小学教育材料统一数据库 - 管理端</h1>

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
        
        <div id="manual-section">
            <h2>📝 手动创建 / 编辑记录 <button onclick="resetManualForm()" style="background-color: #17a2b8;">清空表单</button></h2>
            <form id="material-form">
                <div class="form-row">
                    <div class="form-group">
                        <label for="f_UID">唯一识别码 (UID) *</label>
                        <input type="text" id="f_UID" name="UID" required>
                    </div>
                    <div class="form-group">
                        <label for="f_unified_name">统一名称 *</label>
                        <input type="text" id="f_unified_name" name="unified_name" required>
                    </div>
                    <div class="form-group">
                        <label for="f_material_type">材质</label>
                        <input type="text" id="f_material_type" name="material_type">
                    </div>
                    <div class="form-group">
                        <label for="f_sub_category">小类</label>
                        <input type="text" id="f_sub_category" name="sub_category">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="f_alias">别名</label>
                        <input type="text" id="f_alias" name="alias">
                    </div>
                    <div class="form-group">
                        <label for="f_color">颜色</label>
                        <input type="text" id="f_color" name="color">
                    </div>
                    <div class="form-group">
                        <label for="f_model_number">型号</label>
                        <input type="text" id="f_model_number" name="model_number">
                    </div>
                    <div class="form-group">
                        <label for="f_length_mm">长度 (mm)</label>
                        <input type="number" step="0.01" id="f_length_mm" name="length_mm">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="f_width_mm">宽度 (mm)</label>
                        <input type="number" step="0.01" id="f_width_mm" name="width_mm">
                    </div>
                    <div class="form-group">
                        <label for="f_diameter_mm">直径 (mm)</label>
                        <input type="number" step="0.01" id="f_diameter_mm" name="diameter_mm">
                    </div>
                    <div class="form-group" style="flex: 2;">
                        <label for="f_r2_image_key">R2 图片路径 (r2_image_key)</label>
                        <div class="upload-controls">
                            <input type="text" id="f_r2_image_key" name="r2_image_key" placeholder="例如: folder/image.jpg" style="width: 60%; margin: 0;">
                            <input type="file" id="f_image_file" accept="image/*" style="width: 40%; margin: 0;">
                            <button type="button" onclick="handleImageUpload()" style="flex-shrink: 0; padding: 5px 10px;">上传图片</button>
                        </div>
                    </div>
                </div>
                <button type="submit" id="save-btn" onclick="event.preventDefault(); handleSave()">保存/更新记录</button>
                <p id="manual-status" style="color: blue;"></p>
            </form>
        </div>

        <div id="import-section">
            <h2>📤 批量导入 (支持 CSV / JSON)</h2>
            <input type="file" id="import-file" accept=".json, .csv">
            <button onclick="handleBulkImport()">解析并导入数据</button>
            <p id="import-status" style="color: blue;"></p>
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
                        <th style="width: 25%;">名称 / 型号 / 尺寸</th>
                        <th style="width: 25%;">小类 / 材质 / 颜色</th>
                        <th style="width: 10%;">图片 Key</th>
                        <th style="width: 15%;">操作</th>
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

        // --- 核心 CRUD & Upload 逻辑 ---

        function getAuthHeaders() {
            return {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('jwtToken')
            };
        }
        
        // --- 1. 手动编辑/新增 (Save) ---

        function getFormData() {
            const data = {};
            FIELD_NAMES.forEach(name => {
                const element = document.getElementById('f_' + name);
                if (element) {
                    // 对于数字类型，确保为空时不传递字符串 "null" 或空字符串
                    if (name.endsWith('_mm')) {
                        data[name] = element.value ? parseFloat(element.value) : null;
                    } else {
                        data[name] = element.value || null;
                    }
                }
            });
            return data;
        }

        async function handleSave() {
            const token = localStorage.getItem('jwtToken');
            const status = document.getElementById('manual-status');
            const data = getFormData();

            if (!token) { status.textContent = '请先登录。'; status.style.color = 'red'; return; }
            if (!data.UID || !data.unified_name) {
                status.textContent = 'UID 和 统一名称 不能为空。'; status.style.color = 'red'; return;
            }

            status.textContent = '正在保存/更新记录...';
            status.style.color = 'blue';

            try {
                const response = await fetch(\`\${API_BASE_URL}/materials\`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(data)
                });

                const result = await response.json();

                if (response.ok && result.status === 'success') {
                    status.textContent = \`记录 \${result.uid} 保存成功！\`;
                    status.style.color = 'green';
                    fetchMaterials(); // 刷新列表
                } else {
                    status.textContent = \`保存失败: \${result.message || response.statusText}\`;
                    status.style.color = 'red';
                }

            } catch (error) {
                status.textContent = '网络错误，保存失败: ' + error.message;
                status.style.color = 'red';
            }
        }

        // --- 2. 图片上传 ---

        async function handleImageUpload() {
            const fileInput = document.getElementById('f_image_file');
            const keyInput = document.getElementById('f_r2_image_key');
            const status = document.getElementById('manual-status');
            const token = localStorage.getItem('jwtToken');
            
            if (!token) { status.textContent = '请先登录。'; status.style.color = 'red'; return; }
            if (fileInput.files.length === 0) { status.textContent = '请选择图片文件。'; status.style.color = 'red'; return; }
            const file = fileInput.files[0];
            const r2Key = keyInput.value.trim() || \`uploads/\${Date.now()}/\${file.name}\`;
            
            status.textContent = '正在请求 R2 签名链接...';
            status.style.color = 'blue';

            try {
                // 1. 获取预签名 URL
                const signResponse = await fetch(\`\${API_BASE_URL}/presign-url\`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ key: r2Key })
                });
                
                if (!signResponse.ok) throw new Error(\`签名失败: \${signResponse.statusText}\`);

                const { uploadUrl } = await signResponse.json();
                
                // 2. 直接上传到 R2
                status.textContent = '正在上传文件到 R2...';
                const uploadResponse = await fetch(uploadUrl, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': file.type || 'application/octet-stream',
                        'Content-Length': file.size
                    },
                    body: file
                });
                
                if (!uploadResponse.ok) throw new Error(\`上传失败: \${uploadResponse.statusText}\`);

                // 3. 更新表单字段
                keyInput.value = r2Key; 
                status.textContent = \`图片上传成功！R2 Key: \${r2Key}\`;
                status.style.color = 'green';
                
                // 提示用户保存记录
                if (document.getElementById('f_UID').value) {
                    status.textContent += ' 请点击 "保存/更新记录" 以更新数据库记录。';
                }

            } catch (error) {
                status.textContent = '图片上传失败: ' + error.message;
                status.style.color = 'red';
            }
        }

        // --- 3. 批量导入 ---
        
        function parseCSV(csvText) {
            const lines = csvText.trim().split(/\\r?\\n/); 
            if (lines.length === 0) return [];
            
            const headerLine = lines[0].split(',');
            const headers = headerLine.map(h => h.trim().replace(/['"]+/g, ''));
            const data = [];

            for (let i = 1; i < lines.length; i++) {
                if (!lines[i].trim()) continue;

                const values = lines[i].split(','); 
                let item = {};

                headers.forEach((header, index) => {
                    if (index < values.length) {
                        const key = header.toLowerCase().replace(/[^a-z0-9_]/g, ''); 
                        const matchedField = FIELD_NAMES.find(f => f.toLowerCase() === key || f.toLowerCase().includes(key));
                        if (matchedField) {
                             item[matchedField] = values[index].trim().replace(/['"]+/g, '');
                        }
                    }
                });

                if (Object.keys(item).length < 3) {
                    item = {};
                    FIELD_NAMES.forEach((field, index) => {
                        if (index < values.length) {
                             item[field] = values[index].trim().replace(/['"]+/g, '');
                        }
                    });
                }
                
                ['length_mm', 'width_mm', 'diameter_mm'].forEach(key => {
                    if (item[key]) item[key] = parseFloat(item[key]);
                });
                
                data.push(item);
            }
            return data;
        }

        async function handleBulkImport() {
            const fileInput = document.getElementById('import-file');
            const status = document.getElementById('import-status');
            const token = localStorage.getItem('jwtToken');

            if (!token) { status.textContent = '请先登录。'; status.style.color = 'red'; return; }
            if (fileInput.files.length === 0) { status.textContent = '请选择一个 CSV 或 JSON 文件。'; status.style.color = 'red'; return; }

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
                        headers: getAuthHeaders(),
                        body: JSON.stringify(materialsArray)
                    });

                    const result = await response.json();

                    if (response.ok && result.status === 'success') {
                        status.textContent = \`导入成功！总计处理 \${result.total_processed} 条，导入/更新 \${result.imported_count} 条。\`;
                        status.style.color = 'green';
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

        // --- 4. 删除 ---
        
        async function handleDelete(uid) {
            if (!confirm('确定要删除 UID 为 ' + uid + ' 的材料记录吗？\\n此操作不可逆！')) return;

            const token = localStorage.getItem('jwtToken');
            try {
                const response = await fetch(\`\${API_BASE_URL}/materials/\${uid}\`, {
                    method: 'DELETE',
                    headers: { 'Authorization': 'Bearer ' + token }
                });

                if (response.ok) {
                    alert(\`记录 \${uid} 删除成功！\`);
                    fetchMaterials(); 
                } else if (response.status === 404) {
                    alert(\`删除失败：记录 \${uid} 未找到。\`);
                } else {
                    alert(\`删除失败: \${response.statusText}\`);
                }
            } catch (error) {
                alert('网络错误，删除失败。');
            }
        }
        
        // --- 5. 表单/UI 辅助功能 ---
        
        function resetManualForm() {
            document.getElementById('material-form').reset();
            document.getElementById('manual-status').textContent = '表单已清空。';
            document.getElementById('manual-status').style.color = 'blue';
            document.getElementById('f_UID').disabled = false;
        }

        function handleEdit(material) {
            // 清空状态
            document.getElementById('manual-status').textContent = '正在编辑记录: ' + material.UID;
            document.getElementById('manual-status').style.color = '#17a2b8';
            document.getElementById('f_UID').disabled = true; // 编辑时 UID 不可修改
            
            // 填充表单
            FIELD_NAMES.forEach(name => {
                const element = document.getElementById('f_' + name);
                if (element && material[name] !== undefined) {
                    element.value = material[name];
                }
            });
            // 清空图片文件选择
            document.getElementById('f_image_file').value = '';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }


        // --- 登录/退出功能 ---
        async function handleLogin() {
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

        // --- 查询和渲染 ---

        async function fetchMaterials() {
            const query = document.getElementById('search-query').value;
            const token = localStorage.getItem('jwtToken');
            const body = document.getElementById('results-body');
            body.innerHTML = '<tr><td colspan="6" style="text-align: center;">正在查询...</td></tr>';
            
            if (!token) {
                body.innerHTML = '<tr><td colspan="6" style="color: red; text-align: center;">请先登录。</td></tr>';
                return;
            }

            try {
                const response = await fetch(\`\${API_BASE_URL}/materials?q=\${encodeURIComponent(query)}\`, {
                    headers: { 'Authorization': 'Bearer ' + token }
                });

                if (response.ok) {
                    const materials = await response.json();
                    renderMaterials(materials);
                } else if (response.status === 403 || response.status === 401) {
                    body.innerHTML = '<tr><td colspan="6" style="color: red; text-align: center;">权限过期，请重新登录。</td></tr>';
                    handleLogout();
                } else {
                    body.innerHTML = '<tr><td colspan="6" style="color: red; text-align: center;">查询失败: ' + response.statusText + '</td></tr>';
                }
            } catch (error) {
                body.innerHTML = '<tr><td colspan="6" style="color: red; text-align: center;">网络错误: ' + error.message + '</td></tr>';
            }
        }

        function renderMaterials(materials) {
            const body = document.getElementById('results-body');
            body.innerHTML = ''; 

            if (materials.length === 0) {
                body.innerHTML = '<tr><td colspan="6" style="text-align: center;">未找到匹配的材料。</td></tr>';
                return;
            }

            materials.forEach(mat => {
                const row = body.insertRow();
                
                let dimensions = '';
                if (mat.diameter_mm) {
                    dimensions = \`Ø\${mat.diameter_mm}\`;
                } else if (mat.length_mm && mat.width_mm) {
                    dimensions = \`\${mat.length_mm} x \${mat.width_mm}\`;
                }

                // 移除不必要的字段，只保留需要传给 handleEdit 的数据
                const cleanMat = JSON.stringify(mat).replace(/'/g, "\\\\'"); // 确保字符串可以作为JS参数传递
                
                // 图片单元格
                const imgCell = row.insertCell();
                if (mat.image_url) {
                    imgCell.innerHTML = \`<img src="\${mat.image_url}" class="material-img" alt="\${mat.unified_name}">\`;
                } else {
                    imgCell.textContent = '-';
                }
                
                // 数据展示
                row.insertCell().textContent = mat.UID;
                row.insertCell().innerHTML = \`
                    <span style="font-weight: bold;">\${mat.unified_name}</span> <br>
                    型号: \${mat.model_number || '-'} <br> 
                    尺寸: \${dimensions || '-'}
                \`;
                row.insertCell().innerHTML = \`
                    小类: \${mat.sub_category || '-'} <br>
                    材质: \${mat.material_type || '-'} <br>
                    颜色: \${mat.color || '-'}
                \`;

                row.insertCell().textContent = mat.r2_image_key || '-';

                // 操作按钮
                const actionsCell = row.insertCell();
                actionsCell.innerHTML = \`
                    <button class="edit-btn" onclick='handleEdit(\${cleanMat})'>编辑</button>
                    <button class="delete-btn" onclick="handleDelete('\${mat.UID}')">删除</button>
                \`;
                actionsCell.style.textAlign = 'center';
            });
        }
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

// R2 预签名 URL 生成 (此函数在代码逻辑上是正确的)
async function handleGeneratePresignedUrl(request, env) {
    const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
    
    // R2 BINDING DEBUG CHECK (用于确认绑定是否生效)
    if (!env.R2_BUCKET) {
        return new Response(JSON.stringify({ 
            message: 'R2_BUCKET binding is missing.',
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
        // 捕获 R2 绑定错误
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

// --- D1 CRUD 相关的处理函数 (保持您的实现) ---
// ⚠️ 注意：以下函数体需要保留您本地的 D1 数据库操作逻辑。
async function handleCreateUpdateMaterial(request, env) { 
    const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
    // ... 您的 D1 插入/更新逻辑 ...
    return new Response(JSON.stringify({ message: 'Material updated/created successfully (Placeholder)' }), { status: 200, headers });
}
async function handleDeleteMaterial(request, env) { 
    const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
    // ... 您的 D1 删除逻辑 ...
    return new Response(JSON.stringify({ message: 'Material deleted successfully (Placeholder)' }), { status: 200, headers });
}
async function handleQueryMaterials(request, env) { 
    const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
    // ... 您的 D1 查询逻辑 ...
    return new Response(JSON.stringify({ data: [], message: 'Query successful (Placeholder)' }), { status: 200, headers });
}
async function handleImportMaterials(request, env) { 
    const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
    // ... 您的导入逻辑 ...
    return new Response(JSON.stringify({ message: 'Import successful (Placeholder)' }), { status: 200, headers });
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
            
            // 如果所有 /api/ 路径都没有匹配，则返回 404
            return new Response('API Endpoint Not Found', { status: 404, headers });
        }

        return new Response('Not Found', { status: 404, headers });
    }
};
