// src/worker.js
import * as jwt from '@tsndr/cloudflare-worker-jwt';

// --- 完整的内嵌前端 HTML/JS (已更新布局、访客逻辑、字段顺序和新增价格列) ---
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
        #query-section, #auth-section, #import-section, #manual-section, #price-query-section { 
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
                        <th style="width: 4%;">图片</th>
                        <th style="width: 10%;">统一名称</th>
                        <th style="width: 7%;">材质(大类)</th>
                        <th style="width: 6%;">小类</th>
                        <th style="width: 6%;">型号</th>
                        <th style="width: 5%;">单位</th> 
                        <th style="width: 7%;">规格/尺寸</th>
                        <th style="width: 5%;">直径</th>
                        <th style="width: 5%;">颜色</th>
                        <th style="width: 8%;">唯一识别码(UID)</th>
                        <th style="width: 6%;">最终成本</th>
                        <th style="width: 6%;">最终售价</th>
                        <th style="width: 10%;">备注信息</th> 
                        <th id="actions-header" style="width: 5%;">操作</th>
                    </tr>
                </thead>
                <tbody id="results-body">
                    </tbody>
            </table>
        </div>
        
        <div id="price-query-section">
            <h2>💰 价格详情查询 (高级)</h2>
            <input type="text" id="price-query-uid" placeholder="输入物料 UID" style="width: 200px;">
            <button onclick="fetchPriceDetails()">查询价格详情</button>
            <pre id="price-details-output" style="background-color: #eee; padding: 10px; border-radius: 4px; margin-top: 10px;"></pre>
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
            document.getElementById('logout-btn').style.display = 'none';
            document.getElementById('read-only-notice').style.display = 'block';
            
            // 隐藏操作列头
            const actionsHeader = document.getElementById('actions-header');
            if(actionsHeader) actionsHeader.style.display = 'none';
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
                const response = await fetch(`${API_BASE_URL}/materials`), {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(data)
                });

                const result = await response.json();

                if (response.ok && result.status === 'success') {
                    status.textContent = `记录 ${result.uid} 保存成功！`;
                    status.style.color = 'green';
                    fetchMaterials(); 
                } else {
                    status.textContent = `保存失败: ${result.message || response.statusText}`;
                    status.style.color = 'red';
                }

            } catch (error) {
                status.textContent = '网络错误，保存失败: ' + error.message;
                status.style.color = 'red';
            }
        }

        // --- 2. 图片上传 (逻辑不变) ---

        async function handleImageUpload() {
            if (isReadOnly) return alert('访客模式下禁止操作。');
            const fileInput = document.getElementById('f_image_file');
            const keyInput = document.getElementById('f_r2_image_key');
            const status = document.getElementById('manual-status');
            const token = localStorage.getItem('jwtToken');
            
            
            if (!token) { status.textContent = '请先登录。'; status.style.color = 'red'; return; }
            if (fileInput.files.length === 0) { status.textContent = '请选择图片文件。'; status.style.color = 'red'; return; }
            
            const file = fileInput.files[0];
            const r2Key = keyInput.value.trim() || `uploads/${Date.now()}/${file.name}`;
            
            status.textContent = '正在直接上传文件到 Worker...';
            status.style.color = 'blue';

            try {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('key', r2Key);
                
                const uploadResponse = await fetch(`${API_BASE_URL}/upload`, {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + token },
                    body: formData 
                });
                
                const result = await uploadResponse.json();
                
                if (!uploadResponse.ok || result.status !== 'success') {
                     throw new Error(result.message || uploadResponse.statusText);
                }

                keyInput.value = r2Key; 
                status.textContent = `图片上传成功！R2 Key: ${r2Key}`;
                status.style.color = 'green';
                
                if (document.getElementById('f_UID').value) {
                    status.textContent += ' 请点击 "保存/更新记录" 以更新数据库记录。';
                }

            } catch (error) {
                status.textContent = '图片上传失败: ' + error.message;
                status.style.color = 'red';
            }
        }

        // --- 3. 批量导入 (逻辑不变) ---
        
        function parseCSV(csvText) {
            
            const lines = csvText.trim().split(/\r?\n/); 
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

                    status.textContent = `正在导入 ${materialsArray.length} 条数据...`;
                    status.style.color = 'blue';

                    const response = await fetch(`${API_BASE_URL}/import`, {
                        method: 'POST',
                        headers: getAuthHeaders(),
                        body: JSON.stringify(materialsArray)
                    });

                    const result = await response.json();

                    if (response.ok && result.status === 'success') {
                        status.textContent = `导入成功！总计处理 ${result.total_processed} 条，导入/更新 ${result.imported_count} 条。`;
                        status.style.color = 'green';
                        fetchMaterials();
                    } else {
                        status.textContent = `导入失败: ${result.message || response.statusText}`;
                        status.style.color = 'red';
                    }

                } catch (error) {
                    status.textContent = '文件解析或上传错误: ' + error.message;
                    status.style.color = 'red';
                }
            };

            reader.readAsText(file);
        }

        // --- 4. 删除 (逻辑不变) ---
        
        async function handleDelete(uid) {
            if (isReadOnly) return alert('访客模式下禁止操作。');
            if (!confirm('确定要删除 UID 为 ' + uid + ' 的材料记录吗？\n此操作不可逆！')) return;
            
            const token = localStorage.getItem('jwtToken');
            try {
                const response = await fetch(`${API_BASE_URL}/materials/${uid}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': 'Bearer ' + token }
                });

                if (response.ok) {
                    alert(`记录 ${uid} 删除成功！`);
                    fetchMaterials(); 
                } else if (response.status === 404) {
                    alert(`删除失败：记录 ${uid} 未找到。`);
                } else {
                    alert(`删除失败: ${response.statusText}`);
                }
            } catch (error) {
                alert('网络错误，删除失败。');
            }
        }
        
        // --- 5. 表单/UI 辅助功能 (逻辑不变) ---
        
        function resetManualForm() {
            if (isReadOnly) return alert('访客模式下禁止操作。');
            document.getElementById('material-form').reset();
            document.getElementById('manual-status').textContent = '表单已清空。';
            document.getElementById('manual-status').style.color = 'blue';
            document.getElementById('f_UID').disabled = false;
        }

        function handleEdit(material) {
            if (isReadOnly) return alert('访客模式下禁止操作。');
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


        // --- 6. 登录/退出/访客功能 (逻辑不变) ---
        async function handleLogin() {
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const status = document.getElementById('login-status');
            status.textContent = '正在登录...';
            status.style.color = 'blue';

            try {
                const response = await fetch(`${API_BASE_URL}/login`, {
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
                    document.getElementById('logout-btn').style.display = 'block';
                    
                    const actionsHeader = document.getElementById('actions-header');
                    if(actionsHeader) actionsHeader.style.display = 'table-cell'; 

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

        // --- 7. 查询和渲染 (更新表格结构和逻辑) ---

        async function fetchMaterials() {
            const query = document.getElementById('search-query').value;
            const token = localStorage.getItem('jwtToken'); 
            const body = document.getElementById('results-body');
            const totalCols = isReadOnly ? 13 : 14; 

            body.innerHTML = `<tr><td colspan="${totalCols}" style="text-align: center;">正在查询...</td></tr>`; 
            
            if (!token && !isReadOnly) { 
                body.innerHTML = `<tr><td colspan="${totalCols}" style="color: red; text-align: center;">请先登录或以访客身份查看。</td></tr>`;
                return;
            }

            try {
                const response = await fetch(`${API_BASE_URL}/materials?q=${encodeURIComponent(query)}`, {
                    headers: token ? { 'Authorization': 'Bearer ' + token } : {} 
                });

                if (response.ok) {
                    const materials = await response.json();
                    renderMaterials(materials);
                } else if (response.status === 403 || response.status === 401) {
                    body.innerHTML = `<tr><td colspan="${totalCols}" style="color: red; text-align: center;">权限过期，请重新登录。</td></tr>`;
                    handleLogout();
                } else {
                    body.innerHTML = `<tr><td colspan="${totalCols}" style="color: red; text-align: center;">查询失败: ${response.statusText}</td></tr>`;
                }
            } catch (error) {
                body.innerHTML = `<tr><td colspan="${totalCols}" style="color: red; text-align: center;">网络错误: ${error.message}</td></tr>`;
            }
        }

        function renderMaterials(materials) {
            const body = document.getElementById('results-body');
            body.innerHTML = ''; 
            const totalCols = isReadOnly ? 13 : 14; 

            if (materials.length === 0) {
                body.innerHTML = `<tr><td colspan="${totalCols}" style="text-align: center;">未找到匹配的材料。</td></tr>`;
                return;
            }

            materials.forEach(mat => {
                const row = body.insertRow();
                
                let dimensions = '';
                const length = mat.length_mm;
                const width = mat.width_mm;
                const diameter = mat.diameter_mm;
                
                if (diameter && width) {
                    dimensions = `高: ${width} mm`; 
                } else if (length && width) {
                    dimensions = `${length} x ${width} mm`;
                } else if (length) {
                    dimensions = `${length} mm`;
                } else if (width) {
                    dimensions = `${width} mm`;
                }
                
                const cleanMat = JSON.stringify(mat).replace(/'/g, "\\'"); 
                
                // 1. 图片单元格
                const imgCell = row.insertCell();
                if (mat.image_url) {
                    imgCell.innerHTML = `<a href="${mat.image_url}" target="_blank"><img src="${mat.image_url}" class="material-img" alt="${mat.unified_name}"></a>`;
                } else {
                    imgCell.textContent = '-';
                }
                
                // 2. 统一名称
                row.insertCell().textContent = mat.unified_name || '-';
                
                // 3. 材质 (大类)
                row.insertCell().textContent = mat.material_type || '-';
                
                // 4. 小类
                row.insertCell().textContent = mat.sub_category || '-';

                // 5. 型号
                row.insertCell().textContent = mat.model_number || '-';
                
                // 6. 单位 
                row.insertCell().textContent = mat.unit || '-';
                
                // 7. 规格/尺寸
                row.insertCell().textContent = dimensions || '-';
                
                // 8. 直径
                row.insertCell().textContent = diameter ? `Ø${diameter} mm` : '-';

                // 9. 颜色
                row.insertCell().textContent = mat.color || '-';
                
                // 10. 唯一识别码(UID) 
                row.insertCell().textContent = mat.UID;
                
                // NEW: 11. 最终成本
                row.insertCell().textContent = mat.final_cost ? `¥ ${mat.final_cost.toFixed(2)}` : 'N/A';

                // NEW: 12. 最终售价
                row.insertCell().textContent = mat.final_selling_price ? `¥ ${mat.final_selling_price.toFixed(2)}` : 'N/A';
                
                // 13. 备注信息
                row.insertCell().textContent = mat.notes || '-';

                // 14. 操作 (只在管理员模式下显示)
                if (!isReadOnly) {
                    const actionsCell = row.insertCell();
                    actionsCell.innerHTML = `
                        <button class="edit-btn" onclick='handleEdit(${cleanMat})'>编辑</button>
                        <button class="delete-btn" onclick="handleDelete('${mat.UID}')">删除</button>`;
                    actionsCell.style.textAlign = 'center';
                } else {
                    // 访客模式下，操作列不插入单元格，保持列数一致
                    row.insertCell().textContent = '禁止操作'; 
                    row.cells[row.cells.length - 1].style.display = 'none'; 
                }
            });
            
             if (isReadOnly) {
                 const actionsHeader = document.getElementById('actions-header');
                 if(actionsHeader) actionsHeader.style.display = 'none';
            }
        }
        
        // --- 8. 价格详情查询函数 (NEW) ---
        async function fetchPriceDetails() {
            const uid = document.getElementById('price-query-uid').value.trim();
            const output = document.getElementById('price-details-output');
            const token = localStorage.getItem('jwtToken');

            output.textContent = '正在查询...';
            
            if (!uid) {
                output.textContent = '请输入物料 UID。';
                return;
            }
             if (!token && !isReadOnly) {
                output.textContent = '请先登录。';
                return;
            }
            
            try {
                const response = await fetch(`${API_BASE_URL}/materials/prices?uid=${encodeURIComponent(uid)}`, {
                    headers: token ? { 'Authorization': 'Bearer ' + token } : {} 
                });

                if (response.ok) {
                    const result = await response.json();
                    output.textContent = JSON.stringify(result, null, 2);
                } else {
                    output.textContent = `查询失败 (${response.status}): ${response.statusText}`;
                }
            } catch (error) {
                output.textContent = '网络错误: ' + error.message;
            }
        }
    </script>
</body>
</html>
`; 

// --- Worker 后端逻辑 ---

// ... (comparePassword, getPublicImageUrl, authenticate 保持不变)
async function comparePassword(password, storedHash, env) {
    // 简化处理，实际生产环境需使用 bcrypt/Argon2 等哈希算法
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


// --- NEW: 价格计算和同步逻辑 ---

/**
 * 核心计算函数：根据供应商最新价格和公式配置，计算并同步最终材料价格。
 */
async function calculateAndSyncMaterialPrice(env, material_uid) {
    
    // 1. 获取公式配置
    const formulaStmt = env.DB.prepare(
        "SELECT * FROM price_formulas WHERE material_uid = ?"
    ).bind(material_uid);
    let formula = (await formulaStmt.all()).results[0];

    // 如果没有公式，使用默认公式
    if (!formula) {
        formula = { 
            formula_type: 'MIN_SUPPLIER', // 默认取最低价
            markup_rate: 0.2, 
            tariff_rate: 0.05, 
            shipping_cost: 10.0 
        };
    }

    // 2. 获取所有供应商的最新原始价格
    const pricesStmt = env.DB.prepare(
        "SELECT base_price FROM supplier_prices WHERE material_uid = ?"
    ).bind(material_uid);
    const supplierPrices = (await pricesStmt.all()).results.map(r => r.base_price);
    
    if (supplierPrices.length === 0) {
        console.warn(`No supplier prices found for UID: ${material_uid}`);
        return; 
    }

    // 3. 确定基础采购价格 (Base Purchase Price)
    let basePurchasePrice;
    
    switch (formula.formula_type) {
        case 'MIN_SUPPLIER': // 取所有供应商中的最低价
            basePurchasePrice = Math.min(...supplierPrices);
            break;
        case 'COST_PLUS': // 假设默认取最低价或第一个价
        default:
            basePurchasePrice = Math.min(...supplierPrices); 
            break;
    }

    // 4. 执行计算逻辑
    const tariffRate = formula.tariff_rate || 0;
    const markupRate = formula.markup_rate || 0;
    const shippingCost = formula.shipping_cost || 0;

    // 最终成本价 = (基础采购价格 * (1 + 关税)) + 固定运费
    const finalCost = (basePurchasePrice * (1 + tariffRate)) + shippingCost;

    // 最终销售价 = 最终成本价 * (1 + 利润率)
    const finalSellingPrice = finalCost * (1 + markupRate);
    
    // 5. 写入 material_final_prices 表
    const now = new Date().toISOString();
    const updateStmt = env.DB.prepare(`
        INSERT OR REPLACE INTO material_final_prices 
        (material_uid, final_cost, final_selling_price, last_calculated)
        VALUES (?, ?, ?, ?)
    `).bind(material_uid, finalCost, finalSellingPrice, now);

    await updateStmt.run();
    console.log(`Synced price for ${material_uid}: Cost=${finalCost.toFixed(2)}, Selling=${finalSellingPrice.toFixed(2)}`);
}

/**
 * 供应商价格更新 API (POST /api/supplier/price)
 * 供供应商通过 API Key/Token 更新其提供的原始价格。
 */
async function handleSupplierPriceUpdate(request, env) {
    const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
    if (!env.DB) {
        return new Response(JSON.stringify({ message: 'DB binding is missing.' }), { status: 500, headers });
    }
    
    // ⚠️ 实际项目中：此处应进行供应商API Key或Token的鉴权
    // 假设鉴权已通过，并从Token中提取 supplier_id

    const data = await request.json(); 
    const { supplier_id, material_uid, base_price } = data;

    if (!supplier_id || !material_uid || typeof base_price !== 'number' || base_price < 0) {
        return new Response(JSON.stringify({ message: 'Missing or invalid fields: supplier_id, material_uid, base_price' }), { status: 400, headers });
    }

    try {
        const now = new Date().toISOString();
        // 1. 更新或插入 supplier_prices 表中的原始报价
        const stmt = env.DB.prepare(`
            INSERT OR REPLACE INTO supplier_prices 
            (supplier_id, material_uid, base_price, last_updated)
            VALUES (?, ?, ?, ?)
        `).bind(supplier_id, material_uid, base_price, now);

        await stmt.run();

        // 2. 异步触发价格计算和同步
        // 使用 ctx.waitUntil 来异步执行计算，不阻塞供应商的响应
        // ⚠️ 注意：Worker 的 fetch 函数签名需要包含 ctx 才能使用 ctx.waitUntil
        // 由于我们没有在 fetch 中传递 ctx，这里直接使用 await，这在高并发下可能导致响应延迟
        await calculateAndSyncMaterialPrice(env, material_uid);

        return new Response(JSON.stringify({ 
            status: 'success', 
            message: 'Price updated and final material price calculation triggered.', 
            material_uid 
        }), {
            headers
        });

    } catch (e) {
        console.error("Supplier Price Update error:", e);
        return new Response(JSON.stringify({ message: `Update Failed: ${e.message}` }), { status: 500, headers });
    }
}


/**
 * 内部查询 API，用于查询材料的最终价格和供应商报价。
 * (GET /api/materials/prices?uid=...)
 */
async function handleMaterialPricesQuery(request, env) {
    if (!env.DB) {
        return new Response(JSON.stringify({ message: 'DB binding is missing.' }), { status: 500 });
    }
    const url = new URL(request.url);
    const material_uid = url.searchParams.get('uid');

    if (!material_uid) {
        return new Response(JSON.stringify({ message: 'Missing material UID parameter.' }), { status: 400 });
    }

    try {
        // 1. 查最终价格
        const finalPriceStmt = env.DB.prepare("SELECT * FROM material_final_prices WHERE material_uid = ?").bind(material_uid);
        const finalPrice = (await finalPriceStmt.all()).results[0] || null;

        // 2. 查所有供应商报价
        const supplierPricesStmt = env.DB.prepare("SELECT supplier_id, base_price, last_updated FROM supplier_prices WHERE material_uid = ?").bind(material_uid);
        const supplierPrices = (await supplierPricesStmt.all()).results;
        
        // 3. 查公式配置
        const formulaStmt = env.DB.prepare("SELECT * FROM price_formulas WHERE material_uid = ?").bind(material_uid);
        const formula = (await formulaStmt.all()).results[0] || null;

        return new Response(JSON.stringify({ 
            status: 'success',
            material_uid,
            final_price: finalPrice,
            supplier_prices: supplierPrices,
            formula_config: formula
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (e) {
        console.error("Price Query error:", e);
        return new Response(JSON.stringify({ message: `Query Failed: ${e.message}` }), { status: 500 });
    }
}

// ... (handleLogin, handleDirectUpload 保持不变)

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
        // 更新 SQL 语句以包含 unit 字段
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
            mat.unit || null // NEW: unit 字段绑定
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


// --- 修改后的 handleQueryMaterials 函数 (已添加价格联接) ---
async function handleQueryMaterials(request, env) {
    if (!env.DB) {
        return new Response(JSON.stringify({ message: 'DB binding is missing.' }), { status: 500 });
    }
    try {
        const url = new URL(request.url);
        const query = url.searchParams.get('q') || '';
        
        let stmt;
        
        let baseSql = `
            SELECT 
                m.*, 
                f.final_cost, 
                f.final_selling_price, 
                f.last_calculated 
            FROM materials m
            LEFT JOIN material_final_prices f ON m.UID = f.material_uid
        `;
        
        if (query) {
            const searchPattern = `%${query}%`;
            // 增加 unit 字段到 WHERE 子句
            baseSql += `
                WHERE m.UID LIKE ? OR m.unified_name LIKE ? 
                   OR m.alias LIKE ? OR m.sub_category LIKE ? OR m.model_number LIKE ? OR m.notes LIKE ? OR m.unit LIKE ? 
                LIMIT 100
            `;
            stmt = env.DB.prepare(baseSql).bind(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
        } else {
            baseSql += ` LIMIT 100`;
            stmt = env.DB.prepare(baseSql);
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
            if (!mat.UID) {
                errorMessages.push(`Missing UID for material: ${mat.unified_name || 'unknown'}`);
                return null;
            }
            // 更新 SQL 语句以包含 unit 字段
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
                mat.unit || null // NEW: unit 字段绑定
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
        // 由于设置了外键 ON DELETE CASCADE，删除 materials 表中的记录会自动删除关联的价格记录。
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


// --- 主要 Worker 入口 (已包含新的路由) ---

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
            
            // --- NEW: 供应商价格更新路由 (无需管理/访客认证) ---
            if (path === '/api/supplier/price' && method === 'POST') {
                // ⚠️ 实际环境中需要在这里添加 supplier_id 的 API Key 鉴权
                return handleSupplierPriceUpdate(request, env); 
            }
            
            // --- NEW & Existing: GET /api/materials (主查询) 和 /api/materials/prices (高级价格查询) ---
            
            // 访客和管理员都可访问的主查询
            if (path === '/api/materials' && method === 'GET') {
                return handleQueryMaterials(request, env);
            }
            
            // 高级价格查询 (需要登录或授权)
            if (path === '/api/materials/prices' && method === 'GET') {
                 // 需要管理员或访客权限
                const authResult = await authenticate(request, env);
                if (!authResult.authorized) {
                    return new Response('Authentication Required for this action', { status: 401, headers });
                }
                return handleMaterialPricesQuery(request, env);
            }

            // --- 管理员操作路由 (需要 JWT Token 认证) ---
            const authResult = await authenticate(request, env);
            if (!authResult.authorized) {
                return new Response('Authentication Required for this action', { status: 401, headers });
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
