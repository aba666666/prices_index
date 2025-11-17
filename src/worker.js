// src/worker.js - V5 稳定版 (整合价格查询、供应商更新及账户注册)

import * as jwt from '@tsndr/cloudflare-worker-jwt';

// --- 工具函数：UUID 生成器 (基于 RFC4122 V4) ---
function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// 简单的随机密码生成器 (用于供应商注册)
function generateRandomPassword(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

// --- 完整的内嵌前端 HTML/JS (已更新布局、访客逻辑和字段顺序) ---
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
        #query-section, #auth-section, #import-section, #manual-section, #price-section, #supplier-section { 
            margin-bottom: 30px; 
            padding: 20px; 
            background-color: #fff;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
            border-radius: 8px;
        }
        input:not([type="file"]):not([type="checkbox"]):not([type="radio"]), select, textarea { 
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
            cursor: pointer; 
            transition: opacity 0.3s;
        }
        .material-img:hover {
            opacity: 0.8;
        }
        .upload-controls {
            display: flex;
            gap: 5px;
            align-items: center;
        }
        .readonly-mode {
            background-color: #ffffe0; 
            padding: 10px;
            margin-bottom: 20px;
            border-left: 5px solid #ffc107;
            font-weight: bold;
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
        <button onclick="handleViewAsGuest()">以访客身份查看 (只读)</button>
        <p id="login-status" style="color: red;"></p>
    </div>
    
    <hr>
    
    <div id="main-section" style="display:none;">
        <div id="read-only-notice" class="readonly-mode" style="display:none;">
            您当前处于访客模式（只读）。所有编辑、删除、上传和导入功能已被禁用。
            <button onclick="handleLogout()" style="background-color: #007bff; margin-left: 20px;">返回登录</button>
        </div>
        <button onclick="handleLogout()" id="logout-btn" style="float: right; background-color: #dc3545;">退出登录</button>
        
        <div id="supplier-section">
            <h2>👤 供应商账户注册</h2>
            <form id="supplier-form">
                <div class="form-row">
                    <div class="form-group">
                        <label for="s_company_name">供应商公司名称 *</label>
                        <input type="text" id="s_company_name" required placeholder="例如: 阳光文具厂">
                    </div>
                    <div class="form-group">
                        <label for="s_username">供应商登录名 *</label>
                        <input type="text" id="s_username" required placeholder="例如: yguang123">
                    </div>
                </div>
                <button type="button" onclick="handleSupplierRegister()" id="supplier-register-btn">注册新供应商账户</button>
                <p id="supplier-status" style="color: blue;"></p>
            </form>
        </div>
        
        <div id="manual-section">
            <h2>📝 手动创建 / 编辑记录 <button onclick="resetManualForm()" style="background-color: #17a2b8;">清空表单</button></h2>
            <form id="material-form">
                <div class="form-row">
                    <div class="form-group">
                        <label for="f_unified_name">统一名称 *</label>
                        <input type="text" id="f_unified_name" name="unified_name" required>
                    </div>
                    <div class="form-group">
                        <label for="f_material_type">材质 (大类)</label>
                        <input type="text" id="f_material_type" name="material_type">
                    </div>
                    <div class="form-group">
                        <label for="f_sub_category">小类</label>
                        <input type="text" id="f_sub_category" name="sub_category">
                    </div>
                    <div class="form-group">
                        <label for="f_model_number">型号</label>
                        <input type="text" id="f_model_number" name="model_number">
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="f_unit">单位</label>
                        <input type="text" id="f_unit" name="unit" placeholder="例如: 块, 个, 套, 米">
                    </div>
                    <div class="form-group">
                        <label for="f_length_mm">长度 (mm)</label>
                        <input type="number" step="0.01" id="f_length_mm" name="length_mm">
                    </div>
                    <div class="form-group">
                        <label for="f_width_mm">宽度/高度 (mm)</label> 
                        <input type="number" step="0.01" id="f_width_mm" name="width_mm">
                    </div>
                    <div class="form-group">
                        <label for="f_diameter_mm">直径 (mm)</label>
                        <input type="number" step="0.01" id="f_diameter_mm" name="diameter_mm">
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="f_UID">唯一识别码 (UID) *</label>
                        <input type="text" id="f_UID" name="UID" required>
                    </div>
                    <div class="form-group">
                        <label for="f_notes">备注信息</label>
                        <textarea id="f_notes" name="notes" rows="1" placeholder="例如：采购信息、使用说明等"></textarea>
                    </div>
                     <div class="form-group">
                        <label for="f_color">颜色</label>
                        <input type="text" id="f_color" name="color">
                    </div>
                    <div class="form-group">
                        <label for="f_alias">别名</label>
                        <input type="text" id="f_alias" name="alias">
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group" style="flex: 3;">
                        <label for="f_r2_image_key">R2 图片路径 (r2_image_key)</label>
                        <div class="upload-controls">
                            <input type="text" id="f_r2_image_key" name="r2_image_key" placeholder="例如: folder/image.jpg" style="width: 60%; margin: 0;">
                            <input type="file" id="f_image_file" accept="image/*" style="width: 40%; margin: 0;">
                            <button type="button" onclick="handleImageUpload()" id="upload-btn" style="flex-shrink: 0; padding: 5px 10px;">上传图片</button>
                        </div>
                    </div>
                </div>
                
                <button type="submit" id="save-btn" onclick="event.preventDefault(); handleSave()">保存/更新记录</button>
                <p id="manual-status" style="color: blue;"></p>
            </form>
        </div>
        
        <div id="price-section" style="display:none;">
            <h2>💰 供应商价格更新 (需先编辑材料自动填充UID)</h2>
            <form id="price-form">
                <div class="form-row">
                    <div class="form-group">
                        <label for="p_material_uid">材料 UID * (编辑材料自动填充)</label>
                        <input type="text" id="p_material_uid" required placeholder="唯一识别码">
                    </div>
                    <div class="form-group">
                        <label for="p_company_name">供应商公司名称 *</label>
                        <input type="text" id="p_company_name" required placeholder="例如: 阳光文具厂">
                    </div>
                    <div class="form-group">
                        <label for="p_price_per_unit">单位价格 *</label>
                        <input type="number" step="0.01" id="p_price_per_unit" required placeholder="例如: 15.50">
                    </div>
                    <div class="form-group">
                        <label for="p_currency">币种</label>
                        <input type="text" id="p_currency" value="RMB" placeholder="例如: RMB, USD">
                    </div>
                </div>
                
                <button type="button" onclick="handlePriceUpdate()" id="price-update-btn">更新供应商价格</button>
                <p id="price-status" style="color: blue;"></p>
            </form>
        </div>
        <div id="import-section">
            <h2>📤 批量导入 (支持 CSV / JSON)</h2>
            <input type="file" id="import-file" accept=".json, .csv">
            <button onclick="handleBulkImport()" id="import-btn">解析并导入数据</button>
            <p id="import-status" style="color: blue;"></p>
        </div>

        <div id="query-section">
            <h2>🔍 材料查询与管理</h2>
            <input type="text" id="search-query" placeholder="输入名称、型号、UID或单位进行查询" style="width: 400px;">
            <button onclick="fetchMaterials()">查询</button>
            
            <table id="results-table">
                <thead>
                    <tr>
                        <th style="width: 5%;">图片</th>
                        <th style="width: 13%;">统一名称</th>
                        <th style="width: 8%;">材质(大类)</th>
                        <th style="width: 8%;">小类</th>
                        <th style="width: 8%;">型号</th>
                        <th style="width: 5%;">单位</th> 
                        <th style="width: 8%;">规格/尺寸</th>
                        <th style="width: 7%;">直径</th>
                        <th style="width: 7%;">颜色</th>
                        <th style="width: 10%;">唯一识别码(UID)</th>
                        <th style="width: 8%;">最低采购价</th> 
                        <th style="width: 8%;">备注信息</th> 
                        <th id="actions-header" style="width: 5%;">操作</th>
                    </tr>
                </thead>
                <tbody id="results-body">
                    </tbody>
            </table>
        </div>
    </div>

    <script>
        const API_BASE_URL = '/api'; 
        const FIELD_NAMES = [
            "unified_name", "material_type", "sub_category", "model_number", 
            "unit", 
            "length_mm", "width_mm", "diameter_mm", "color", 
            "UID", "notes", "alias", "r2_image_key"
        ];
        let isReadOnly = false;

        window.onload = function() {
            const token = localStorage.getItem('jwtToken');
            const guest = localStorage.getItem('isGuest');

            if (token) {
                isReadOnly = false;
                showMainSection();
                fetchMaterials(); 
            } else if (guest === 'true') {
                isReadOnly = true;
                showMainSection();
                setReadOnlyMode();
                fetchMaterials();
            }
        };
        
        function showMainSection() {
            document.getElementById('auth-section').style.display = 'none';
            document.getElementById('main-section').style.display = 'block';
        }

        function setReadOnlyMode() {
            isReadOnly = true;
            document.getElementById('manual-section').style.display = 'none';
            document.getElementById('import-section').style.display = 'none';
            document.getElementById('price-section').style.display = 'none'; 
            document.getElementById('supplier-section').style.display = 'none'; // 禁用供应商注册
            document.getElementById('logout-btn').style.display = 'none';
            document.getElementById('read-only-notice').style.display = 'block';
            document.getElementById('actions-header').style.display = 'none';
        }

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
            if (isReadOnly) return alert('访客模式下禁止操作。');
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
                    fetchMaterials(); 
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
            if (isReadOnly) return alert('访客模式下禁止操作。');
            const fileInput = document.getElementById('f_image_file');
            const keyInput = document.getElementById('f_r2_image_key');
            const status = document.getElementById('manual-status');
            const token = localStorage.getItem('jwtToken');
            
            
            if (!token) { status.textContent = '请先登录。'; status.style.color = 'red'; return; }
            if (fileInput.files.length === 0) { status.textContent = '请选择图片文件。'; status.style.color = 'red'; return; }
            
            const file = fileInput.files[0];
            const r2Key = keyInput.value.trim() || \`uploads/\${Date.now()}/\${file.name}\`;
            
            status.textContent = '正在直接上传文件到 Worker...';
            status.style.color = 'blue';

            try {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('key', r2Key);
                
                const uploadResponse = await fetch(\`\${API_BASE_URL}/upload\`, {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + token },
                    body: formData 
                });
                
                const result = await uploadResponse.json();
                
                if (!uploadResponse.ok || result.status !== 'success') {
                     throw new Error(result.message || uploadResponse.statusText);
                }

                keyInput.value = r2Key; 
                status.textContent = \`图片上传成功！R2 Key: \${r2Key}\`;
                status.style.color = 'green';
                
                if (document.getElementById('f_UID').value) {
                    status.textContent += ' 请点击 "保存/更新记录" 以更新数据库记录。';
                }

            } catch (error) {
                status.textContent = '图片上传失败: ' + error.message;
                status.style.color = 'red';
            }
        }
        
        // --- 3. 价格更新 ---
        async function handlePriceUpdate() {
            if (isReadOnly) return alert('访客模式下禁止操作。');
            const token = localStorage.getItem('jwtToken');
            const status = document.getElementById('price-status');
            
            const data = {
                material_uid: document.getElementById('p_material_uid').value.trim(),
                company_name: document.getElementById('p_company_name').value.trim(),
                price_per_unit: parseFloat(document.getElementById('p_price_per_unit').value),
                currency: document.getElementById('p_currency').value.trim() || 'RMB'
            };
            
            if (!token) { status.textContent = '请先登录。'; status.style.color = 'red'; return; }
            if (!data.material_uid || !data.company_name || isNaN(data.price_per_unit) || data.price_per_unit <= 0) {
                status.textContent = '请填写有效的 材料 UID、供应商名称和正数单位价格。'; 
                status.style.color = 'red'; 
                return;
            }

            status.textContent = '正在更新供应商价格...';
            status.style.color = 'blue';

            try {
                const response = await fetch(\`\${API_BASE_URL}/prices\`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(data)
                });

                const result = await response.json();

                if (response.ok && result.status === 'success') {
                    status.textContent = \`UID: \${result.material_uid} 的价格在 \${result.company_name} (UUID: \${result.supplier_uuid}) 处更新成功！\`;
                    status.style.color = 'green';
                    fetchMaterials(); 
                } else {
                    status.textContent = \`价格更新失败: \${result.message || response.statusText}\`;
                    status.style.color = 'red';
                }

            } catch (error) {
                status.textContent = '网络错误，价格更新失败: ' + error.message;
                status.style.color = 'red';
            }
        }
        // --- END 价格更新 ---
        
        // --- 4. 供应商注册 ---
        async function handleSupplierRegister() {
            if (isReadOnly) return alert('访客模式下禁止操作。');
            const token = localStorage.getItem('jwtToken');
            const status = document.getElementById('supplier-status');
            
            const data = {
                company_name: document.getElementById('s_company_name').value.trim(),
                username: document.getElementById('s_username').value.trim()
            };
            
            if (!token) { status.textContent = '请先登录。'; status.style.color = 'red'; return; }
            if (!data.company_name || !data.username) {
                status.textContent = '请填写有效的 供应商名称 和 登录名。'; 
                status.style.color = 'red'; 
                return;
            }

            status.textContent = '正在注册供应商账户...';
            status.style.color = 'blue';

            try {
                const response = await fetch(\`\${API_BASE_URL}/suppliers/register\`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(data)
                });

                const result = await response.json();

                if (response.ok && result.status === 'success') {
                    status.innerHTML = \`
                        <span style="color: green;">账户注册成功！请记录以下信息：</span>
                        <br><strong>公司 UUID (Supplier ID):</strong> \${result.supplier_uuid}
                        <br><strong>登录名 (Username):</strong> \${result.username}
                        <br><strong>临时密码 (Password):</strong> <span style="color: red;">\${result.password}</span>
                    \`;
                } else {
                    status.textContent = \`账户注册失败: \${result.message || response.statusText}\`;
                    status.style.color = 'red';
                }

            } catch (error) {
                status.textContent = '网络错误，账户注册失败: ' + error.message;
                status.style.color = 'red';
            }
        }
        // --- END 供应商注册 ---


        // --- 5. 批量导入 (保持原有逻辑) ---
        
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
            if (isReadOnly) return alert('访客模式下禁止操作。');
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

        // --- 6. 删除 ---
        
        async function handleDelete(uid) {
            if (isReadOnly) return alert('访客模式下禁止操作。');
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
        
        // --- 7. 表单/UI 辅助功能 (handleEdit新增填充价格UID) ---
        
        function resetManualForm() {
            if (isReadOnly) return alert('访客模式下禁止操作。');
            document.getElementById('material-form').reset();
            document.getElementById('manual-status').textContent = '表单已清空。';
            document.getElementById('manual-status').style.color = 'blue';
            document.getElementById('f_UID').disabled = false;
        }

        function handleEdit(material) {
            if (isReadOnly) return alert('访客模式下禁止操作。');
            document.getElementById('manual-status').textContent = '正在编辑记录: ' + material.UID;
            document.getElementById('manual-status').style.color = '#17a2b8';
            document.getElementById('f_UID').disabled = true; 
            
            FIELD_NAMES.forEach(name => {
                const element = document.getElementById('f_' + name);
                if (element && material[name] !== undefined) {
                    element.value = material[name];
                }
            });
            
            // 关键：填充 UID 到价格更新表单 
            if(document.getElementById('p_material_uid')) {
                 document.getElementById('p_material_uid').value = material.UID; 
            }

            document.getElementById('f_image_file').value = '';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }


        // --- 登录/退出/访客功能 ---
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
                    localStorage.removeItem('isGuest'); 
                    status.textContent = '登录成功！(管理员模式)';
                    status.style.color = 'green';
                    
                    isReadOnly = false;
                    document.getElementById('read-only-notice').style.display = 'none';
                    document.getElementById('manual-section').style.display = 'block';
                    document.getElementById('import-section').style.display = 'block';
                    document.getElementById('price-section').style.display = 'block'; 
                    document.getElementById('supplier-section').style.display = 'block'; 
                    document.getElementById('logout-btn').style.display = 'block';
                    document.getElementById('actions-header').style.display = 'table-cell'; 

                    showMainSection();
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
        
        function handleViewAsGuest() {
            localStorage.removeItem('jwtToken');
            localStorage.setItem('isGuest', 'true');
            document.getElementById('login-status').textContent = '已进入访客模式。';
            document.getElementById('login-status').style.color = '#007bff';
            
            isReadOnly = true;
            showMainSection();
            setReadOnlyMode();
            fetchMaterials();
        }

        function handleLogout() {
            localStorage.removeItem('jwtToken');
            localStorage.removeItem('isGuest');
            
            document.getElementById('main-section').style.display = 'none';
            document.getElementById('auth-section').style.display = 'block';
            document.getElementById('login-status').textContent = '已退出登录。';
            document.getElementById('login-status').style.color = 'green';
            isReadOnly = false;
        }

        // --- 查询和渲染 (更新表格结构和逻辑) ---

        async function fetchMaterials() {
            const query = document.getElementById('search-query').value;
            const token = localStorage.getItem('jwtToken'); 
            const body = document.getElementById('results-body');
            // 调整列数 (13列)
            const totalCols = isReadOnly ? 12 : 13; 
            body.innerHTML = \`<tr><td colspan="\${totalCols}" style="text-align: center;">正在查询...</td></tr>\`; 
            
            if (!token && !isReadOnly) { 
                body.innerHTML = \`<tr><td colspan="\${totalCols}" style="color: red; text-align: center;">请先登录或以访客身份查看。</td></tr>\`;
                return;
            }

            try {
                const response = await fetch(\`\${API_BASE_URL}/materials?q=\${encodeURIComponent(query)}\`, {
                    headers: token ? { 'Authorization': 'Bearer ' + token } : {} 
                });

                if (response.ok) {
                    const materials = await response.json();
                    renderMaterials(materials);
                } else if (response.status === 403 || response.status === 401) {
                    body.innerHTML = \`<tr><td colspan="\${totalCols}" style="color: red; text-align: center;">权限过期，请重新登录。</td></tr>\`;
                    handleLogout();
                } else {
                    body.innerHTML = \`<tr><td colspan="\${totalCols}" style="color: red; text-align: center;">查询失败: \${response.statusText}</td></tr>\`;
                }
            } catch (error) {
                body.innerHTML = \`<tr><td colspan="\${totalCols}" style="color: red; text-align: center;">网络错误: \${error.message}</td></tr>\`;
            }
        }

        function renderMaterials(materials) {
            const body = document.getElementById('results-body');
            body.innerHTML = ''; 
            const totalCols = isReadOnly ? 12 : 13; 

            if (materials.length === 0) {
                body.innerHTML = \`<tr><td colspan="\${totalCols}" style="text-align: center;">未找到匹配的材料。</td></tr>\`;
                return;
            }

            materials.forEach(mat => {
                const row = body.insertRow();
                
                let dimensions = '';
                const length = mat.length_mm;
                const width = mat.width_mm;
                const diameter = mat.diameter_mm;
                
                if (diameter && width) {
                    dimensions = \`高: \${width} mm\`; 
                } else if (length && width) {
                    dimensions = \`\${length} x \${width} mm\`;
                } else if (length) {
                    dimensions = \`\${length} mm\`;
                } else if (width) {
                    dimensions = \`\${width} mm\`;
                }
                
                const safeMaterial = JSON.stringify(mat).replace(/'/g, "\\\\'"); 
                
                const imgCell = row.insertCell();
                if (mat.image_url) {
                    imgCell.innerHTML = \`<a href="\${mat.image_url}" target="_blank"><img src="\${mat.image_url}" class="material-img" alt="\${mat.unified_name}"></a>\`;
                } else {
                    imgCell.textContent = '-';
                }
                
                row.insertCell().textContent = mat.unified_name || '-';
                row.insertCell().textContent = mat.material_type || '-';
                row.insertCell().textContent = mat.sub_category || '-';
                row.insertCell().textContent = mat.model_number || '-';
                row.insertCell().textContent = mat.unit || '-';
                row.insertCell().textContent = dimensions || '-';
                row.insertCell().textContent = diameter ? \`Ø\${diameter} mm\` : '-';
                row.insertCell().textContent = mat.color || '-';
                row.insertCell().textContent = mat.UID;
                
                const priceCell = row.insertCell();
                if (mat.lowest_price_per_unit) {
                     priceCell.innerHTML = \`\${mat.lowest_price_per_unit.toFixed(2)} <span style="font-size: 0.8em; color: #6c757d;">\${mat.price_currency || ''}</span>\`;
                     priceCell.style.fontWeight = 'bold';
                     priceCell.style.color = '#dc3545';
                } else {
                     priceCell.textContent = 'N/A';
                }
                
                row.insertCell().textContent = mat.notes || '-';

                if (!isReadOnly) {
                    const actionsCell = row.insertCell();
                    actionsCell.innerHTML = \`
                        <button class="edit-btn" onclick='handleEdit(\${safeMaterial})'>编辑</button>
                        <button class="delete-btn" onclick="handleDelete('\${mat.UID}')">删除</button>
                    \`;
                    actionsCell.style.textAlign = 'center';
                } else {
                    row.insertCell().style.display = 'none'; 
                }
            });
            
             if (isReadOnly) {
                 document.getElementById('actions-header').style.display = 'none';
            }
        }
    </script>
</body>
</html>
`; 

// --- Worker 后端逻辑 ---

async function comparePassword(password, storedHash, env) {
    // 假设您的 D1 数据库中存储的是 'testpass' 
    return password === storedHash;
}

function getPublicImageUrl(r2_key, env) {
    if (!r2_key || !env.R2_PUBLIC_DOMAIN) return null;
    return `${env.R2_PUBLIC_DOMAIN}/${r2_key}`;
}

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

const ADMIN_ACTIONS = ['POST', 'PUT', 'DELETE'];

function isReadOnlyRequest(method, path) {
    if (method === 'GET') {
        return true; 
    }
    if (ADMIN_ACTIONS.includes(method)) {
        return false;
    }
    return true; 
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
        
        // 注意：此处是简化的密码比较，实际生产环境应使用 bcrypt/argon2
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

async function handleDirectUpload(request, env) {
    const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

    if (!env.R2_MEDIA) {
        return new Response(JSON.stringify({ 
            message: 'R2_MEDIA binding is missing. CHECK WRANGLER.TOML and DEPLOYMENT.'
        }), { status: 500, headers });
    }
    
    if (request.headers.get('Content-Type')?.includes('multipart/form-data') === false) {
         return new Response(JSON.stringify({ message: 'Missing or wrong Content-Type header. Expected multipart/form-data.' }), { status: 400, headers });
    }

    try {
        const formData = await request.formData();
        const file = formData.get('file'); 
        const r2Key = formData.get('key'); 

        if (!file || !r2Key || typeof file === 'string') {
            return new Response(JSON.stringify({ message: 'Missing file or R2 key in form data or file is empty.' }), { status: 400, headers });
        }
        
        await env.R2_MEDIA.put(r2Key, file.stream(), {
            httpMetadata: { contentType: file.type || 'application/octet-stream' }
        }); 

        return new Response(JSON.stringify({ 
            status: 'success', 
            r2Key: r2Key, 
            message: `File ${r2Key} uploaded directly to R2.` 
        }), { headers });

    } catch (e) {
        console.error("Direct Upload error:", e);
        return new Response(JSON.stringify({ 
            message: `Direct upload failed: ${e.message}.`,
            debug: `R2_MEDIA object type: ${typeof env.R2_MEDIA}. Contains put? ${typeof env.R2_MEDIA?.put}`
        }), { 
            status: 500,
            headers
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
            (UID, unified_name, material_type, sub_category, model_number, length_mm, width_mm, diameter_mm, color, notes, alias, r2_image_key, unit)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            mat.UID, mat.unified_name, mat.material_type, mat.sub_category, mat.model_number, 
            mat.length_mm, mat.width_mm, mat.diameter_mm, 
            mat.color,
            mat.notes || null, 
            mat.alias,
            mat.r2_image_key || null,
            mat.unit || null 
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

// --- UPDATED: 供应商价格更新 API 处理器 (使用 UUID) ---

async function handleUpdateSupplierPrice(request, env) {
    if (!env.DB) {
        return new Response(JSON.stringify({ message: 'DB binding is missing.' }), { status: 500 });
    }
    const data = await request.json();

    const { material_uid, company_name, price_per_unit, currency = 'RMB' } = data;

    if (!material_uid || !company_name || typeof price_per_unit !== 'number' || price_per_unit <= 0) {
        return new Response(JSON.stringify({ message: 'Missing or invalid fields: material_uid, company_name, price_per_unit' }), { status: 400 });
    }

    try {
        // 1. 查找供应商 (必须先注册)
        let supplier_uuid;
        const { results: existingSuppliers } = await env.DB.prepare(
            "SELECT supplier_uuid FROM suppliers WHERE company_name = ?"
        ).bind(company_name).all();

        if (existingSuppliers.length === 0) {
            return new Response(JSON.stringify({ message: `Supplier company "${company_name}" not found. Please register the supplier first.` }), { status: 404 });
        }
        
        supplier_uuid = existingSuppliers[0].supplier_uuid;

        // 2. 插入或更新价格 (使用 material_uid 和 supplier_uuid 进行联合绑定)
        await env.DB.prepare(`
            INSERT INTO prices (material_uid, supplier_uuid, price_per_unit, currency, last_updated)
            VALUES (?, ?, ?, ?, datetime('now'))
            ON CONFLICT(material_uid, supplier_uuid) DO UPDATE SET
                price_per_unit = excluded.price_per_unit,
                currency = excluded.currency,
                last_updated = excluded.last_updated
        `).bind(material_uid, supplier_uuid, price_per_unit, currency).run();


        return new Response(JSON.stringify({ 
            status: 'success', 
            message: 'Price updated successfully.', 
            material_uid, 
            company_name, 
            supplier_uuid 
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (e) {
        console.error("Price Update error:", e);
        return new Response(JSON.stringify({ message: `Price Update Failed: ${e.message}` }), { status: 500 });
    }
}
// --- END UPDATED ---


// --- NEW: 供应商账户注册 API 处理器 ---
async function handleRegisterSupplier(request, env) {
    if (!env.DB) {
        return new Response(JSON.stringify({ message: 'DB binding is missing.' }), { status: 500 });
    }
    const data = await request.json();
    const { company_name, username } = data;
    
    if (!company_name || !username) {
        return new Response(JSON.stringify({ message: 'Missing required fields: company_name and username.' }), { status: 400 });
    }

    try {
        // 1. 检查供应商是否已注册
        const { results: existingSuppliers } = await env.DB.prepare(
            "SELECT supplier_uuid FROM suppliers WHERE company_name = ?"
        ).bind(company_name).all();

        if (existingSuppliers.length > 0) {
            return new Response(JSON.stringify({ message: `Supplier company "${company_name}" already exists (UUID: ${existingSuppliers[0].supplier_uuid}).` }), { status: 409 });
        }

        // 2. 检查用户名是否已存在 (在 users 表中)
        const { results: existingUsers } = await env.DB.prepare(
            "SELECT id FROM users WHERE username = ?"
        ).bind(username).all();
        
        if (existingUsers.length > 0) {
            return new Response(JSON.stringify({ message: `Username "${username}" already exists.` }), { status: 409 });
        }

        // 3. 生成 UUID 和密码
        const supplier_uuid = uuidv4(); 
        const temporary_password = generateRandomPassword(); // 临时密码

        // 4. 插入 suppliers 表
        await env.DB.prepare(
            "INSERT INTO suppliers (supplier_uuid, company_name) VALUES (?, ?)"
        ).bind(supplier_uuid, company_name).run();

        // 5. 插入 users 表 (假设 users 表结构为 id, username, password_hash, role)
        // 注意：这里使用临时密码作为 password_hash，实际应使用哈希函数
        await env.DB.prepare(
            "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)"
        ).bind(username, temporary_password, 'supplier').run();


        return new Response(JSON.stringify({ 
            status: 'success', 
            message: 'Supplier and user registered successfully.', 
            supplier_uuid,
            username,
            password: temporary_password // ⚠️ 实际生产环境不应返回明文密码
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (e) {
        console.error("Supplier Registration error:", e);
        return new Response(JSON.stringify({ message: `Registration Failed: ${e.message}` }), { status: 500 });
    }
}
// --- END NEW ---


// --- 关键更新：使用 CTE (WITH) 和 Window Function 实现稳定查询 ---
async function handleQueryMaterials(request, env) {
    if (!env.DB) {
        return new Response(JSON.stringify({ message: 'DB binding is missing.' }), { status: 500 });
    }
    try {
        const url = new URL(request.url);
        const query = url.searchParams.get('q') || '';
        
        let stmt;
        
        // 使用 CTE (Common Table Expression) 和 Window Function 查找每个材料的最低价格
        const baseQuery = `
            WITH RankedPrices AS (
                SELECT 
                    material_uid, 
                    price_per_unit,
                    currency,
                    -- 给每个材料的价格进行排名，最低价 (ASC) 且最新 (DESC) 的排名为 1
                    ROW_NUMBER() OVER (
                        PARTITION BY material_uid 
                        ORDER BY price_per_unit ASC, last_updated DESC
                    ) AS rn
                FROM prices
            )
            SELECT 
                m.*,
                r.price_per_unit AS lowest_price_per_unit,
                r.currency AS price_currency
            FROM materials m
            LEFT JOIN RankedPrices r ON m.UID = r.material_uid AND r.rn = 1
        `;

        if (query) {
            const searchPattern = `%${query}%`;
            stmt = env.DB.prepare(`
                ${baseQuery}
                WHERE m.UID LIKE ? OR m.unified_name LIKE ? 
                   OR m.alias LIKE ? OR m.sub_category LIKE ? OR m.model_number LIKE ? OR m.notes LIKE ? OR m.unit LIKE ? 
                LIMIT 100
            `).bind(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern); 
        } else {
            stmt = env.DB.prepare(`${baseQuery} LIMIT 100`);
        }
        
        const { results } = await stmt.all();

        const materialsWithUrls = results.map(mat => {
            const lowest_price_per_unit = mat.lowest_price_per_unit ? parseFloat(mat.lowest_price_per_unit) : null; 
            const currency = mat.price_currency || null; 
            
            return {
                ...mat,
                image_url: getPublicImageUrl(mat.r2_image_key, env),
                lowest_price_per_unit: lowest_price_per_unit,
                price_currency: currency
            }
        });

        return new Response(JSON.stringify(materialsWithUrls), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (e) {
        console.error("Query error:", e);
        // 如果表不存在，会返回 D1_ERROR
        return new Response(JSON.stringify({ message: `Database Query Failed: ${e.message}`, debug: "Please ensure D1 migration 0002 has been applied correctly." }), { status: 500 });
    }
}
// --- END 关键更新 ---


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
            if (!mat.UID) {
                errorMessages.push(`Missing UID for material: ${mat.unified_name || 'unknown'}`);
                return null;
            }
            return env.DB.prepare(`
                INSERT OR REPLACE INTO materials 
                (UID, unified_name, material_type, sub_category, model_number, length_mm, width_mm, diameter_mm, color, notes, alias, r2_image_key, unit)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                mat.UID, mat.unified_name, mat.material_type, mat.sub_category, mat.model_number, 
                parseFloat(mat.length_mm) || null, 
                parseFloat(mat.width_mm) || null,
                parseFloat(mat.diameter_mm) || null,
                mat.color,
                mat.notes || null,
                mat.alias,
                mat.r2_image_key || null,
                mat.unit || null 
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
        // 删除材料记录，由于外键约束，关联的价格记录也会被删除
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
            return new Response(null, { headers: { ...headers, 'Content-Type': undefined } } );
        }

        if (path === '/' && method === 'GET') {
             return new Response(FRONTEND_HTML, { headers: { 'Content-Type': 'text/html' } });
        }

        if (path === '/api/login' && method === 'POST') {
            return handleLogin(request, env);
        }
        
        if (path.startsWith('/api/')) {
            
            if (isReadOnlyRequest(method, path)) {
                if (path === '/api/materials' && method === 'GET') {
                    return handleQueryMaterials(request, env);
                }
            }

            const authResult = await authenticate(request, env); 
            if (!authResult.authorized) {
                if (method === 'GET') {
                    return new Response('Not Found or Unauthorized', { status: 404, headers });
                }
                return new Response('Authentication Required for this action', { status: 401, headers });
            }
            
            // NEW: 供应商账户注册 API
            if (path === '/api/suppliers/register' && method === 'POST') {
                return handleRegisterSupplier(request, env);
            }
            
            // 价格管理 API
            if (path === '/api/prices' && method === 'POST') {
                return handleUpdateSupplierPrice(request, env);
            }
            
            if (path.startsWith('/api/materials/') && method === 'DELETE') {
                return handleDeleteMaterial(request, env); 
            }

            if (path === '/api/materials' && method === 'POST') {
                 return handleCreateUpdateMaterial(request, env); 
            }
            
            if (path === '/api/upload' && method === 'POST') {
                return handleDirectUpload(request, env); 
            }

            if (path === '/api/import' && method === 'POST') {
                return handleImportMaterials(request, env); 
            }
        }

        return new Response('Not Found', { status: 404 }); 
    }
};
