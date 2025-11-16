// src/worker.js
import * as jwt from '@tsndr/cloudflare-worker-jwt';

// --- 完整的内嵌前端 HTML/JS (已更新布局、访客逻辑和 CSV 解析/编码修复) ---
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
        /* 优化图片样式，确保图片可点击 */
        .material-img { 
            max-width: 50px; 
            max-height: 50px; 
            object-fit: cover;
            border-radius: 4px;
            cursor: pointer; /* 提示用户可以点击 */
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
            background-color: #ffffe0; /* 浅黄色背景提示只读 */
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
                        <label for="f_length_mm">规格 - 长度 (mm)</label>
                        <input type="number" step="0.01" id="f_length_mm" name="length_mm">
                    </div>
                    <div class="form-group">
                        <label for="f_width_mm">规格 - 宽度 (mm)</label>
                        <input type="number" step="0.01" id="f_width_mm" name="width_mm">
                    </div>
                    <div class="form-group">
                        <label for="f_diameter_mm">直径 (mm)</label>
                        <input type="number" step="0.01" id="f_diameter_mm" name="diameter_mm">
                    </div>
                    <div class="form-group">
                        <label for="f_color">颜色</label>
                        <input type="text" id="f_color" name="color">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="f_UID">唯一识别码 (UID) *</label>
                        <input type="text" id="f_UID" name="UID" required>
                    </div>
                    <div class="form-group">
                        <label for="f_alias">别名</label>
                        <input type="text" id="f_alias" name="alias">
                    </div>
                    <div class="form-group" style="flex: 2;">
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
            <p style="font-size: 0.9em; color: #555;">CSV 文件第一行 (表头) 必须包含以下字段的中文或英文名，顺序不限，但建议：统一名称, 材质(大类), 小类, 型号, 长度(mm), 宽度(mm), 直径(mm), 颜色, 唯一识别码(UID)。</p>
            <input type="file" id="import-file" accept=".json, .csv">
            <button onclick="handleBulkImport()" id="import-btn">解析并导入数据</button>
            <p id="import-status" style="color: blue;"></p>
        </div>

        <div id="query-section">
            <h2>🔍 材料查询与管理</h2>
            <input type="text" id="search-query" placeholder="输入名称、型号或UID进行查询" style="width: 400px;">
            <button onclick="fetchMaterials()">查询</button>
            
            <table id="results-table">
                <thead>
                    <tr>
                        <th style="width: 5%;">图片</th>
                        <th style="width: 12%;">统一名称</th>
                        <th style="width: 10%;">材质(大类)</th>
                        <th style="width: 10%;">小类</th>
                        <th style="width: 10%;">型号</th>
                        <th style="width: 10%;">规格/尺寸 (长x宽)</th>
                        <th style="width: 8%;">直径</th>
                        <th style="width: 8%;">颜色</th>
                        <th style="width: 15%;">唯一识别码(UID)</th>
                        <th id="actions-header" style="width: 12%;">操作</th>
                    </tr>
                </thead>
                <tbody id="results-body">
                    </tbody>
            </table>
        </div>
    </div>
    `
    

    <script>
        const API_BASE_URL = '/api'; 
        // 完整的数据库字段列表，用于表单和 CSV 解析映射
        const FIELD_NAMES = ["UID", "unified_name", "material_type", "sub_category", "alias", "color", "model_number", "length_mm", "width_mm", "diameter_mm", "r2_image_key"];
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
                const response = await fetch(`${API_BASE_URL}/materials`, {
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

        // --- 2. 图片上传 (使用 presign-url 逻辑) ---

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
            
            status.textContent = '正在请求 R2 签名链接...';
            status.style.color = 'blue';

            try {
                // 1. 获取预签名 URL
                const signResponse = await fetch(`${API_BASE_URL}/presign-url`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ key: r2Key })
                });
                
                if (!signResponse.ok) throw new Error(`签名失败: ${signResponse.statusText}`);

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
                
                if (!uploadResponse.ok) throw new Error(`上传失败: ${uploadResponse.statusText}`);

                // 3. 更新表单字段
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

        // --- 3. 批量导入 - CSV 解析 (已优化按列名映射) ---
        
        function parseCSV(csvText) {
            const lines = csvText.trim().split(/\r?\n/); 
            if (lines.length === 0) return [];
            
            const TARGET_FIELDS = ["UID", "unified_name", "material_type", "sub_category", "alias", "color", "model_number", "length_mm", "width_mm", "diameter_mm", "r2_image_key"];
            
            // 1. 解析表头并进行标准化映射
            const headerLine = lines[0].split(',');
            const headers = headerLine.map(h => {
                 let cleanHeader = h.trim().toLowerCase().replace(/['"“”\s/]/g, '');
                 if (cleanHeader.includes('统一名称')) return 'unified_name';
                 if (cleanHeader.includes('大类')) return 'material_type';
                 if (cleanHeader.includes('小类')) return 'sub_category';
                 if (cleanHeader.includes('型号')) return 'model_number';
                 if (cleanHeader.includes('长度')) return 'length_mm';
                 if (cleanHeader.includes('宽度')) return 'width_mm';
                 if (cleanHeader.includes('直径')) return 'diameter_mm';
                 if (cleanHeader.includes('颜色')) return 'color';
                 if (cleanHeader.includes('唯一识别码') || cleanHeader === 'uid') return 'UID';
                 if (cleanHeader.includes('别名')) return 'alias';
                 if (cleanHeader.includes('图片路径') || cleanHeader === 'r2_image_key') return 'r2_image_key';
                 return cleanHeader; // 使用原始清理后的英文名
            });
            
            const data = [];

            // 2. 遍历数据行
            for (let i = 1; i < lines.length; i++) {
                if (!lines[i].trim()) continue;

                const values = lines[i].split(','); 
                let item = {};

                headers.forEach((header, index) => {
                    if (index < values.length) {
                        const rawValue = values[index].trim().replace(/['"“”]+/g, '');
                        
                        // 严格匹配 TARGET_FIELDS
                        if (TARGET_FIELDS.includes(header)) {
                             item[header] = rawValue;
                        }
                    }
                });

                // 3. 转换数字类型
                ['length_mm', 'width_mm', 'diameter_mm'].forEach(key => {
                    if (item[key]) {
                        const num = parseFloat(item[key]);
                        item[key] = isNaN(num) ? null : num;
                    } else {
                        item[key] = null;
                    }
                });
                
                // 4. 确保核心字段不为空
                if (item.UID && item.unified_name) {
                    data.push(item);
                } else {
                    console.warn(`跳过无效行 (缺少UID或统一名称): ${lines[i]}`);
                }
            }
            return data;
        }


        // --- 3. 批量导入处理 (已修复中文 CSV 乱码) ---

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
                        // 使用已读取的内容进行 CSV 解析
                        materialsArray = parseCSV(content); 
                    } else {
                        status.textContent = '不支持的文件类型。'; status.style.color = 'red'; return;
                    }

                    if (!Array.isArray(materialsArray) || materialsArray.length === 0) {
                        status.textContent = '文件内容错误或未解析到有效数据。'; status.style.color = 'red'; return;
                    }
                    
                    status.textContent = `正在导入 ${materialsArray.length} 条有效数据...`;
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
            
            // 解决中文乱码问题：尝试使用 GBK 编码读取 CSV 文件
            if (file.name.toLowerCase().endsWith('.csv')) {
                 try {
                     // 尝试使用 GBK 编码，兼容 Windows/Excel 导出的中文 CSV
                     reader.readAsText(file, 'GBK'); 
                 } catch (e) {
                     // 如果浏览器不支持 GBK，则退回 UTF-8 并给出提示
                     reader.readAsText(file); 
                     status.textContent = '警告：浏览器不支持 GBK 编码，已使用 UTF-8。若乱码，请将 CSV 文件另存为 UTF-8 编码！';
                     status.style.color = 'orange';
                 }
            } else {
                 // JSON 或其他文件保持默认 UTF-8
                 reader.readAsText(file); 
            }
        }

        // --- 4. 删除 ---
        
        async function handleDelete(uid) {
            if (isReadOnly) return alert('访客模式下禁止操作。');
            if (!confirm('确定要删除 UID 为 ' + uid + ' 的材料记录吗？\\n此操作不可逆！')) return;

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
        
        // --- 5. 表单/UI 辅助功能 ---
        
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


        // --- 登录/退出/访客功能 ---
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
                    // 强制显示操作列 (编辑/删除)
                    if (document.getElementById('actions-header')) document.getElementById('actions-header').style.display = 'table-cell'; 

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

        // --- 查询和渲染 ---

        async function fetchMaterials() {
            const query = document.getElementById('search-query').value;
            const token = localStorage.getItem('jwtToken'); 
            const body = document.getElementById('results-body');
            body.innerHTML = '<tr><td colspan="10" style="text-align: center;">正在查询...</td></tr>';
            
            if (!token && !isReadOnly) { 
                body.innerHTML = '<tr><td colspan="10" style="color: red; text-align: center;">请先登录或以访客身份查看。</td></tr>';
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
                    body.innerHTML = '<tr><td colspan="10" style="color: red; text-align: center;">权限过期，请重新登录。</td></tr>';
                    handleLogout();
                } else {
                    body.innerHTML = '<tr><td colspan="10" style="color: red; text-align: center;">查询失败: ' + response.statusText + '</td></tr>';
                }
            } catch (error) {
                body.innerHTML = '<tr><td colspan="10" style="color: red; text-align: center;">网络错误: ' + error.message + '</td></tr>';
            }
        }

        function renderMaterials(materials) {
            const body = document.getElementById('results-body');
            body.innerHTML = ''; 

            if (materials.length === 0) {
                body.innerHTML = '<tr><td colspan="10" style="text-align: center;">未找到匹配的材料。</td></tr>';
                return;
            }

            materials.forEach(mat => {
                const row = body.insertRow();
                
                // 规格/尺寸 字段合并：长度 x 宽度
                let dimensions = '';
                if (mat.length_mm && mat.width_mm) {
                    dimensions = `${mat.length_mm} x ${mat.width_mm} mm`;
                } else if (mat.length_mm) {
                    dimensions = `${mat.length_mm} mm`;
                } else if (mat.width_mm) {
                    dimensions = `${mat.width_mm} mm`;
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
                
                // 6. 规格/尺寸 (长x宽)
                row.insertCell().textContent = dimensions || '-';
                
                // 7. 直径
                row.insertCell().textContent = mat.diameter_mm ? `Ø${mat.diameter_mm} mm` : '-';

                // 8. 颜色
                row.insertCell().textContent = mat.color || '-';
                
                // 9. 唯一识别码(UID)
                row.insertCell().textContent = mat.UID;

                // 10. 操作 (只在管理员模式下显示)
                const actionsCell = row.insertCell();
                if (!isReadOnly) {
                    actionsCell.innerHTML = `
                        <button class="edit-btn" onclick='handleEdit(${cleanMat})'>编辑</button>
                        <button class="delete-btn" onclick="handleDelete('${mat.UID}')">删除</button>
                    `;
                    actionsCell.style.textAlign = 'center';
                } else {
                    actionsCell.textContent = '只读'; 
                    actionsCell.style.textAlign = 'center';
                    // 访客模式下隐藏操作列
                    actionsCell.style.display = 'none';
                }
            });
            
             // 确保表格的头部和主体在访客模式下保持一致
            if (isReadOnly) {
                 document.getElementById('actions-header').style.display = 'none';
                 // 重新调整表格布局以适应列的隐藏
                 document.getElementById('results-table').style.tableLayout = 'auto'; 
            } else {
                 document.getElementById('actions-header').style.display = 'table-cell';
                 document.getElementById('results-table').style.tableLayout = 'fixed'; 
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

// --- API 路由处理函数 ---

async function handleLogin(request, env) {
    if (!env.DB) {
        // 使用硬编码的登录凭证进行调试（如果 DB 绑定丢失）
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
        
        // 注意：这里需要替换为真实的密码哈希比较逻辑
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
        // 创建一个用于 PUT 操作的预签名 URL，有效期 5 分钟
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
        
        // 数据库排序：按统一名称、大类、小类、型号、UID 升序排列
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
                mat.length_mm, // 这里的 mat.length_mm 已经是 number 或 null
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

        if (path === '/' && method === 'GET') {
             return new Response(FRONTEND_HTML, { headers: { 'Content-Type': 'text/html' } });
        }

        if (path === '/api/login' && method === 'POST') {
            return handleLogin(request, env);
        }
        
        if (path.startsWith('/api/')) {
            
            // GET /api/materials (Query) - 允许未认证用户访问 (访客模式)
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

            // POST /api/materials (Manual Create/Update)
            if (path === '/api/materials' && method === 'POST') {
                 return handleCreateUpdateMaterial(request, env);
            }
            
            // POST /api/presign-url (R2 Upload)
            if (path === '/api/presign-url' && method === 'POST') {
                return handleGeneratePresignedUrl(request, env);
            }

            // POST /api/import (Bulk Import)
            if (path === '/api/import' && method === 'POST') {
                return handleImportMaterials(request, env);
            }
        }

        return new Response('Not Found', { status: 404 });
    }
};
