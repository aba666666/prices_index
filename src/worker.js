// src/worker.js
import * as jwt from '@tsndr/cloudflare-worker-jwt';

// --- 完整的内嵌前端 HTML/JS (已保留原有功能，新增供应商管理) ---
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
        
        /* --- 新增：Tab 导航样式 --- */
        .nav-tabs { margin-bottom: 20px; border-bottom: 1px solid #ddd; }
        .nav-btn {
            padding: 10px 20px; cursor: pointer; background: #e9ecef; border: none;
            border-radius: 5px 5px 0 0; margin-right: 5px; font-weight: bold; font-size: 1rem;
        }
        .nav-btn.active { background: #007bff; color: white; }
        .tab-content { display: none; }
        .tab-content.active { display: block; }
        /* -------------------------- */

        #query-section, #auth-section, #import-section, #manual-section, #supplier-section { 
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
        button:hover { background-color: #218838; } /* 修复hover颜色覆盖问题 */
        button.delete-btn:hover { background-color: #c82333; }
        button.edit-btn:hover { background-color: #e0a800; }

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
        
        <div class="nav-tabs">
            <button class="nav-btn active" onclick="switchTab('materials')" id="btn-tab-materials">📦 材料库管理</button>
            <button class="nav-btn" onclick="switchTab('suppliers')" id="btn-tab-suppliers">🏭 供应商管理</button>
        </div>

        <div id="tab-materials" class="tab-content active">
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
                            <input type="text" id="f_unit" name="unit" placeholder="例如: 块, 个, 套">
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
                            <label for="f_price">参考价格 (元)</label>
                            <input type="number" step="0.01" id="f_price" name="price" placeholder="0.00">
                        </div>
                        <div class="form-group" style="flex: 2;">
                            <label for="f_appearance">外观描述</label>
                            <input type="text" id="f_appearance" name="appearance" placeholder="例如: 表面光滑、磨砂质感、带Logo">
                        </div>
                        <div class="form-group">
                            <label for="f_supplier_id">关联供应商</label>
                            <select id="f_supplier_id" name="supplier_id">
                                <option value="">(无供应商)</option>
                                </select>
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
                            <th style="width: 5%;">图片</th>
                            <th style="width: 12%;">统一名称</th>
                            <th style="width: 8%;">供应商</th> <th style="width: 6%;">价格</th>  <th style="width: 8%;">外观</th>  <th style="width: 8%;">材质(大类)</th>
                            <th style="width: 8%;">型号</th>
                            <th style="width: 5%;">单位</th> 
                            <th style="width: 8%;">规格/尺寸</th>
                            <th style="width: 10%;">唯一识别码(UID)</th>
                            <th style="width: 10%;">备注信息</th> 
                            <th id="actions-header" style="width: 8%;">操作</th>
                        </tr>
                    </thead>
                    <tbody id="results-body">
                        </tbody>
                </table>
            </div>
        </div>

        <div id="tab-suppliers" class="tab-content">
            <div id="supplier-section">
                <h2>🏭 供应商管理</h2>
                <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                    <h4>添加 / 编辑 供应商</h4>
                    <input type="hidden" id="s_id"> <div class="form-row">
                        <div class="form-group">
                            <label>供应商名称 *</label>
                            <input type="text" id="s_name" placeholder="例如: 晨光文具厂">
                        </div>
                        <div class="form-group">
                            <label>账号 / 支付信息</label>
                            <input type="text" id="s_account" placeholder="例如: 支付宝 138xxxx / 银行卡号">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>备注 (联系人、地址等)</label>
                        <textarea id="s_notes" rows="1"></textarea>
                    </div>
                    <button onclick="handleSaveSupplier()">保存供应商信息</button>
                    <button onclick="resetSupplierForm()" style="background-color: #17a2b8;">重置表单</button>
                    <p id="supplier-status" style="color: blue;"></p>
                </div>

                <h3>供应商列表 <button onclick="fetchSuppliers()" style="font-size: 0.7em; padding: 5px;">刷新列表</button></h3>
                <table id="suppliers-table">
                    <thead>
                        <tr>
                            <th width="5%">ID</th>
                            <th width="20%">名称</th>
                            <th width="25%">账号信息</th>
                            <th width="30%">备注</th>
                            <th width="20%">操作</th>
                        </tr>
                    </thead>
                    <tbody id="suppliers-body"></tbody>
                </table>
            </div>
        </div>
    </div>

    <script>
        const API_BASE_URL = '/api'; 
        // 字段数组新增 price, appearance, supplier_id
        const FIELD_NAMES = [
            "unified_name", "material_type", "sub_category", "model_number", 
            "unit", "length_mm", "width_mm", "diameter_mm", "color", 
            "UID", "notes", "alias", "r2_image_key",
            "price", "appearance", "supplier_id" // <-- NEW
        ];
        let isReadOnly = false;
        let allSuppliers = []; // 缓存供应商数据

        window.onload = function() {
            const token = localStorage.getItem('jwtToken');
            const guest = localStorage.getItem('isGuest');

            if (token) {
                isReadOnly = false;
                showMainSection();
                initData(); // 初始化数据
            } else if (guest === 'true') {
                isReadOnly = true;
                showMainSection();
                setReadOnlyMode();
                initData();
            }
        };
        
        function initData() {
            // 先加载供应商，再加载材料(以便匹配名称)
            fetchSuppliers().then(() => {
                fetchMaterials();
            });
        }
        
        function showMainSection() {
            document.getElementById('auth-section').style.display = 'none';
            document.getElementById('main-section').style.display = 'block';
        }
        
        function switchTab(tab) {
            // 切换 Tab UI
            document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
            
            document.getElementById('tab-' + tab).classList.add('active');
            document.getElementById('btn-tab-' + tab).classList.add('active');
        }

        function setReadOnlyMode() {
            isReadOnly = true;
            document.getElementById('manual-section').style.display = 'none';
            document.getElementById('import-section').style.display = 'none';
            // 访客模式下隐藏供应商管理入口
            document.getElementById('btn-tab-suppliers').style.display = 'none';
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
        
        // ==================== 供应商管理逻辑 (新增) ====================
        
        async function fetchSuppliers() {
            if (isReadOnly) return; // 访客不需要加载供应商详细列表，但材料表查询时后端会返回名称
            
            try {
                const response = await fetch(API_BASE_URL + '/suppliers', { headers: getAuthHeaders() });
                if (response.ok) {
                    allSuppliers = await response.json();
                    renderSupplierTable();
                    updateSupplierDropdown(); // 更新材料表单里的下拉框
                }
            } catch (e) {
                console.error("Failed to fetch suppliers", e);
            }
        }

        function renderSupplierTable() {
            const tbody = document.getElementById('suppliers-body');
            tbody.innerHTML = '';
            allSuppliers.forEach(s => {
                const row = tbody.insertRow();
                row.innerHTML = \`
                    <td>\${s.id}</td>
                    <td><strong>\${s.name}</strong></td>
                    <td>\${s.account_info || '-'}</td>
                    <td>\${s.notes || '-'}</td>
                    <td>
                        <button class="edit-btn" onclick="editSupplier(\${s.id})">编辑</button>
                        <button class="delete-btn" onclick="deleteSupplier(\${s.id})">删除</button>
                    </td>
                \`;
            });
        }
        
        function updateSupplierDropdown() {
            const select = document.getElementById('f_supplier_id');
            select.innerHTML = '<option value="">(无供应商)</option>'; // Reset
            allSuppliers.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.id;
                opt.textContent = s.name;
                select.appendChild(opt);
            });
        }

        function editSupplier(id) {
            const s = allSuppliers.find(x => x.id == id);
            if (!s) return;
            document.getElementById('s_id').value = s.id;
            document.getElementById('s_name').value = s.name;
            document.getElementById('s_account').value = s.account_info || '';
            document.getElementById('s_notes').value = s.notes || '';
            document.getElementById('supplier-status').textContent = "正在编辑供应商: " + s.name;
        }
        
        function resetSupplierForm() {
            document.getElementById('s_id').value = '';
            document.getElementById('s_name').value = '';
            document.getElementById('s_account').value = '';
            document.getElementById('s_notes').value = '';
            document.getElementById('supplier-status').textContent = "";
        }

        async function handleSaveSupplier() {
            if (isReadOnly) return;
            const id = document.getElementById('s_id').value;
            const name = document.getElementById('s_name').value;
            const account = document.getElementById('s_account').value;
            const notes = document.getElementById('s_notes').value;
            
            if (!name) return alert("供应商名称必填");
            
            const data = { id: id ? parseInt(id) : null, name, account_info: account, notes };
            
            try {
                const res = await fetch(API_BASE_URL + '/suppliers', {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(data)
                });
                if (res.ok) {
                    resetSupplierForm();
                    fetchSuppliers();
                    alert("供应商保存成功");
                } else {
                    alert("保存失败");
                }
            } catch(e) { alert("Error: " + e.message); }
        }

        async function deleteSupplier(id) {
            if (!confirm("确定删除该供应商吗？关联该供应商的材料将不再显示供应商名称。")) return;
            try {
                const res = await fetch(\`\${API_BASE_URL}/suppliers/\${id}\`, {
                    method: 'DELETE',
                    headers: getAuthHeaders()
                });
                if(res.ok) fetchSuppliers();
                else alert("删除失败");
            } catch(e) { alert("Error"); }
        }

        // ==================== 材料管理逻辑 (原有逻辑更新) ====================

        function getFormData() {
            const data = {};
            FIELD_NAMES.forEach(name => {
                const element = document.getElementById('f_' + name);
                if (element) {
                    if (name.endsWith('_mm') || name === 'price') {
                        data[name] = element.value ? parseFloat(element.value) : null;
                    } else if (name === 'supplier_id') {
                        data[name] = element.value ? parseInt(element.value) : null;
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

        // --- 2. 图片上传 (保持不变) ---

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

        // --- 3. 批量导入 (保持不变，但需注意CSV需要匹配新字段) ---
        
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
                        // 匹配 notes, unit, price, appearance 等
                        const matchedField = FIELD_NAMES.find(f => f.toLowerCase() === key || f.toLowerCase().includes(key));
                        if (matchedField) {
                             item[matchedField] = values[index].trim().replace(/['"]+/g, '');
                        }
                    }
                });
                
                // 数值转换
                ['length_mm', 'width_mm', 'diameter_mm', 'price'].forEach(key => {
                    if (item[key]) item[key] = parseFloat(item[key]);
                });
                if (item['supplier_id']) item['supplier_id'] = parseInt(item['supplier_id']);
                
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
            if (fileInput.files.length === 0) { status.textContent = '请选择文件。'; status.style.color = 'red'; return; }
            
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

                    status.textContent = \`正在导入 \${materialsArray.length} 条数据...\`;
                    status.style.color = 'blue';

                    const response = await fetch(\`\${API_BASE_URL}/import\`, {
                        method: 'POST',
                        headers: getAuthHeaders(),
                        body: JSON.stringify(materialsArray)
                    });

                    const result = await response.json();

                    if (response.ok && result.status === 'success') {
                        status.textContent = \`导入成功！导入/更新 \${result.imported_count} 条。\`;
                        status.style.color = 'green';
                        fetchMaterials();
                    } else {
                        status.textContent = \`导入失败: \${result.message}\`;
                        status.style.color = 'red';
                    }
                } catch (error) {
                    status.textContent = '错误: ' + error.message;
                    status.style.color = 'red';
                }
            };
            reader.readAsText(file);
        }

        // --- 4. 删除 (保持不变) ---
        
        async function handleDelete(uid) {
            if (isReadOnly) return alert('访客模式下禁止操作。');
            if (!confirm('确定要删除 UID 为 ' + uid + ' 的材料记录吗？')) return;
            
            const token = localStorage.getItem('jwtToken');
            try {
                const response = await fetch(\`\${API_BASE_URL}/materials/\${uid}\`, {
                    method: 'DELETE',
                    headers: { 'Authorization': 'Bearer ' + token }
                });

                if (response.ok) {
                    alert(\`记录 \${uid} 删除成功！\`);
                    fetchMaterials(); 
                } else {
                    alert(\`删除失败: \${response.statusText}\`);
                }
            } catch (error) {
                alert('网络错误，删除失败。');
            }
        }
        
        // --- 5. UI 辅助 ---
        
        function resetManualForm() {
            if (isReadOnly) return;
            document.getElementById('material-form').reset();
            document.getElementById('manual-status').textContent = '表单已清空。';
            document.getElementById('f_UID').disabled = false;
        }

        function handleEdit(material) {
            if (isReadOnly) return alert('访客模式下禁止操作。');
            
            // 确保切换到材料页
            switchTab('materials');
            
            document.getElementById('manual-status').textContent = '正在编辑记录: ' + material.UID;
            document.getElementById('manual-status').style.color = '#17a2b8';
            document.getElementById('f_UID').disabled = true; 
            
            FIELD_NAMES.forEach(name => {
                const element = document.getElementById('f_' + name);
                if (element && material[name] !== undefined) {
                    element.value = material[name];
                }
            });
            document.getElementById('f_image_file').value = '';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }


        // --- 登录/退出 (保持不变) ---
        async function handleLogin() {
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const status = document.getElementById('login-status');
            status.textContent = '正在登录...';

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
                    status.textContent = '登录成功！';
                    status.style.color = 'green';
                    
                    isReadOnly = false;
                    document.getElementById('read-only-notice').style.display = 'none';
                    document.getElementById('manual-section').style.display = 'block';
                    document.getElementById('import-section').style.display = 'block';
                    document.getElementById('logout-btn').style.display = 'block';
                    document.getElementById('btn-tab-suppliers').style.display = 'inline-block'; // Show supplier tab
                    document.getElementById('actions-header').style.display = 'table-cell'; 

                    showMainSection();
                    initData();
                } else {
                    status.textContent = '登录失败: ' + (await response.text());
                    status.style.color = 'red';
                }
            } catch (error) {
                status.textContent = '错误: ' + error.message;
                status.style.color = 'red';
            }
        }
        
        function handleViewAsGuest() {
            localStorage.removeItem('jwtToken');
            localStorage.setItem('isGuest', 'true');
            isReadOnly = true;
            showMainSection();
            setReadOnlyMode();
            initData();
        }

        function handleLogout() {
            localStorage.removeItem('jwtToken');
            localStorage.removeItem('isGuest');
            document.getElementById('main-section').style.display = 'none';
            document.getElementById('auth-section').style.display = 'block';
            document.getElementById('login-status').textContent = '已退出登录。';
            isReadOnly = false;
        }

        // --- 查询和渲染 (更新以支持新列) ---

        async function fetchMaterials() {
            const query = document.getElementById('search-query').value;
            const token = localStorage.getItem('jwtToken'); 
            const body = document.getElementById('results-body');
            body.innerHTML = '<tr><td colspan="12" style="text-align: center;">正在查询...</td></tr>'; 
            
            try {
                const response = await fetch(\`\${API_BASE_URL}/materials?q=\${encodeURIComponent(query)}\`, {
                    headers: token ? { 'Authorization': 'Bearer ' + token } : {} 
                });

                if (response.ok) {
                    const materials = await response.json();
                    renderMaterials(materials);
                } else {
                    body.innerHTML = '<tr><td colspan="12" style="color: red; text-align: center;">查询失败</td></tr>';
                }
            } catch (error) {
                body.innerHTML = '<tr><td colspan="12" style="color: red; text-align: center;">网络错误: ' + error.message + '</td></tr>';
            }
        }

        function renderMaterials(materials) {
            const body = document.getElementById('results-body');
            body.innerHTML = ''; 

            if (materials.length === 0) {
                body.innerHTML = \`<tr><td colspan="12" style="text-align: center;">未找到匹配的材料。</td></tr>\`;
                return;
            }

            materials.forEach(mat => {
                const row = body.insertRow();
                
                // 规格显示逻辑
                let dimensions = '';
                const length = mat.length_mm;
                const width = mat.width_mm;
                const diameter = mat.diameter_mm;
                if (diameter && width) dimensions = \`高: \${width} mm\`; 
                else if (length && width) dimensions = \`\${length} x \${width} mm\`;
                else if (length) dimensions = \`\${length} mm\`;
                else if (width) dimensions = \`\${width} mm\`;
                
                const cleanMat = JSON.stringify(mat).replace(/'/g, "\\\\'"); 
                
                // 1. 图片
                const imgCell = row.insertCell();
                if (mat.image_url) {
                    imgCell.innerHTML = \`<a href="\${mat.image_url}" target="_blank"><img src="\${mat.image_url}" class="material-img" alt="\${mat.unified_name}"></a>\`;
                } else { imgCell.textContent = '-'; }
                
                // 2. 统一名称
                row.insertCell().textContent = mat.unified_name || '-';
                
                // 3. 供应商 (New, 显示名称而不是ID)
                const supCell = row.insertCell();
                supCell.innerHTML = mat.supplier_name ? \`<strong style="color:#007bff">\${mat.supplier_name}</strong>\` : '<span style="color:#ccc">无</span>';

                // 4. 价格 (New)
                row.insertCell().textContent = mat.price ? '¥' + mat.price.toFixed(2) : '-';

                // 5. 外观 (New)
                row.insertCell().textContent = mat.appearance || '-';
                
                // 6-8. 其他基本信息
                row.insertCell().textContent = mat.material_type || '-';
                row.insertCell().textContent = mat.model_number || '-';
                row.insertCell().textContent = mat.unit || '-';
                
                // 9-11. 规格/UID/备注
                row.insertCell().textContent = dimensions || '-';
                row.insertCell().textContent = mat.UID;
                row.insertCell().textContent = mat.notes || '-';

                // 12. 操作
                if (!isReadOnly) {
                    const actionsCell = row.insertCell();
                    actionsCell.innerHTML = \`
                        <button class="edit-btn" onclick='handleEdit(\${cleanMat})'>编辑</button>
                        <button class="delete-btn" onclick="handleDelete('\${mat.UID}')">删除</button>
                    \`;
                } else {
                    const cell = row.insertCell();
                    cell.style.display = 'none';
                }
            });
        }
    </script>
</body>
</html>
`; 

// --- Worker 后端逻辑 ---

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
        if (!isValid) return { authorized: false, status: 403 };
        return { authorized: true };
    } catch (e) {
        return { authorized: false, status: 403 };
    }
}

// --- API 路由处理函数 ---

const ADMIN_ACTIONS = ['POST', 'PUT', 'DELETE'];
function isReadOnlyRequest(method, path) {
    if (method === 'GET') return true; 
    if (ADMIN_ACTIONS.includes(method)) return false;
    return true; 
}

async function handleLogin(request, env) {
    // 保持原有登录逻辑
    if (!env.DB) {
        const { username, password } = await request.json();
        if (username === 'test' && password === 'testpass') {
             const token = await jwt.sign({ user: 'admin', exp: Math.floor(Date.now() / 1000) + 86400 }, env.JWT_SECRET);
             return new Response(JSON.stringify({ token, user_id: 1 }), { headers: { 'Content-Type': 'application/json' } });
        }
        return new Response('DB missing', { status: 401 });
    }
    try {
        const { username, password } = await request.json();
        const { results: users } = await env.DB.prepare("SELECT id, password_hash FROM users WHERE username = ?").bind(username).all();
        if (users.length === 0) return new Response('User not found', { status: 401 });
        
        const user = users[0];
        if (!await comparePassword(password, user.password_hash || 'testpass', env)) { 
             return new Response('Password mismatch', { status: 401 });
        }
        const token = await jwt.sign({ user_id: user.id, exp: Math.floor(Date.now()/1000)+86400 }, env.JWT_SECRET);
        return new Response(JSON.stringify({ token, user_id: user.id }), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
        return new Response(`Error: ${e.message}`, { status: 500 });
    }
}

async function handleDirectUpload(request, env) {
    // 保持原有上传逻辑
    const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
    if (!env.R2_MEDIA) return new Response(JSON.stringify({ message: 'R2 missing' }), { status: 500, headers });
    
    try {
        const formData = await request.formData();
        const file = formData.get('file'); 
        const r2Key = formData.get('key'); 
        if (!file || !r2Key) return new Response(JSON.stringify({ message: 'Missing file/key' }), { status: 400, headers });
        
        await env.R2_MEDIA.put(r2Key, file.stream(), { httpMetadata: { contentType: file.type } }); 
        return new Response(JSON.stringify({ status: 'success', r2Key, message: 'Uploaded' }), { headers });
    } catch (e) {
        return new Response(JSON.stringify({ message: e.message }), { status: 500, headers });
    }
}

// --- 新增：供应商管理 API ---
async function handleSuppliers(request, env) {
    if (!env.DB) return new Response('DB missing', { status: 500 });
    const method = request.method;
    
    if (method === 'GET') {
        // 获取所有供应商
        const { results } = await env.DB.prepare("SELECT * FROM suppliers ORDER BY id DESC").all();
        return new Response(JSON.stringify(results), { headers: { 'Content-Type': 'application/json' } });
    }
    
    if (method === 'POST') {
        // 新增或编辑
        const data = await request.json();
        if (!data.name) return new Response('Name required', { status: 400 });
        
        if (data.id) {
            // Edit
            await env.DB.prepare("UPDATE suppliers SET name=?, account_info=?, notes=? WHERE id=?")
                .bind(data.name, data.account_info, data.notes, data.id).run();
        } else {
            // Create
            await env.DB.prepare("INSERT INTO suppliers (name, account_info, notes) VALUES (?, ?, ?)")
                .bind(data.name, data.account_info, data.notes).run();
        }
        return new Response(JSON.stringify({ status: 'success' }), { headers: { 'Content-Type': 'application/json' } });
    }
}

async function handleDeleteSupplier(request, env) {
    const url = new URL(request.url);
    const id = url.pathname.split('/').pop();
    // 删除供应商
    await env.DB.prepare("DELETE FROM suppliers WHERE id = ?").bind(id).run();
    // 可选：把关联该供应商的材料的 supplier_id 置为 NULL
    await env.DB.prepare("UPDATE materials SET supplier_id = NULL WHERE supplier_id = ?").bind(id).run();
    
    return new Response(JSON.stringify({ status: 'success' }), { headers: { 'Content-Type': 'application/json' } });
}

// --- 核心业务逻辑 (已更新支持新字段) ---

async function handleCreateUpdateMaterial(request, env) {
    if (!env.DB) return new Response('DB missing', { status: 500 });
    const mat = await request.json();
    if (!mat.UID || !mat.unified_name) return new Response('Missing fields', { status: 400 });

    try {
        // SQL 更新：加入 price, appearance, supplier_id
        const stmt = env.DB.prepare(`
            INSERT OR REPLACE INTO materials 
            (UID, unified_name, material_type, sub_category, model_number, length_mm, width_mm, diameter_mm, color, notes, alias, r2_image_key, unit, price, appearance, supplier_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            mat.UID, mat.unified_name, mat.material_type, mat.sub_category, mat.model_number, 
            mat.length_mm, mat.width_mm, mat.diameter_mm, 
            mat.color, mat.notes, mat.alias, mat.r2_image_key, mat.unit,
            mat.price || null,       // New
            mat.appearance || null,  // New
            mat.supplier_id || null  // New
        );

        await stmt.run();
        return new Response(JSON.stringify({ status: 'success', uid: mat.UID }), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
        return new Response(JSON.stringify({ message: e.message }), { status: 500 });
    }
}

async function handleQueryMaterials(request, env) {
    if (!env.DB) return new Response('DB missing', { status: 500 });
    try {
        const url = new URL(request.url);
        const query = url.searchParams.get('q') || '';
        let stmt;
        
        // SQL 更新：使用 LEFT JOIN 获取供应商名字
        const baseSql = `
            SELECT m.*, s.name as supplier_name 
            FROM materials m 
            LEFT JOIN suppliers s ON m.supplier_id = s.id 
        `;
        
        if (query) {
            const searchPattern = `%${query}%`;
            // 允许通过供应商名称搜索
            stmt = env.DB.prepare(`${baseSql} WHERE m.UID LIKE ? OR m.unified_name LIKE ? OR m.unit LIKE ? OR s.name LIKE ? LIMIT 100`)
                .bind(searchPattern, searchPattern, searchPattern, searchPattern);
        } else {
            stmt = env.DB.prepare(`${baseSql} LIMIT 100`);
        }
        
        const { results } = await stmt.all();
        const materialsWithUrls = results.map(mat => ({
            ...mat,
            image_url: getPublicImageUrl(mat.r2_image_key, env) 
        }));

        return new Response(JSON.stringify(materialsWithUrls), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
        return new Response(JSON.stringify({ message: 'Query Failed: ' + e.message }), { status: 500 });
    }
}

async function handleImportMaterials(request, env) {
    if (!env.DB) return new Response('DB missing', { status: 500 });
    const materials = await request.json(); 
    if (!Array.isArray(materials)) return new Response('Invalid data', { status: 400 });

    try {
        const statements = materials.map(mat => {
            if (!mat.UID) return null;
            // 批量导入也包含新字段
            return env.DB.prepare(`
                INSERT OR REPLACE INTO materials 
                (UID, unified_name, material_type, sub_category, model_number, length_mm, width_mm, diameter_mm, color, notes, alias, r2_image_key, unit, price, appearance, supplier_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                mat.UID, mat.unified_name, mat.material_type, mat.sub_category, mat.model_number, 
                parseFloat(mat.length_mm)||null, parseFloat(mat.width_mm)||null, parseFloat(mat.diameter_mm)||null,
                mat.color, mat.notes, mat.alias, mat.r2_image_key, mat.unit,
                mat.price || null, 
                mat.appearance || null, 
                mat.supplier_id || null
            );
        }).filter(s => s !== null);
        
        if (statements.length > 0) await env.DB.batch(statements);

        return new Response(JSON.stringify({ status: 'success', imported_count: statements.length }), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
        return new Response(JSON.stringify({ status: 'error', message: e.message }), { status: 500 });
    }
}

async function handleDeleteMaterial(request, env) {
    if (!env.DB) return new Response('DB missing', { status: 500 });
    const uid = new URL(request.url).pathname.split('/').pop();
    try {
        const result = await env.DB.prepare("DELETE FROM materials WHERE UID = ?").bind(uid).run();
        if (result.changes === 0) return new Response('Not found', { status: 404 });
        return new Response(JSON.stringify({ status: 'success' }), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
        return new Response(JSON.stringify({ message: e.message }), { status: 500 });
    }
}

// --- 主要 Worker 入口 (路由分发) ---

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

        if (method === 'OPTIONS') return new Response(null, { headers: { ...headers, 'Content-Type': undefined } } );
        if (path === '/' && method === 'GET') return new Response(FRONTEND_HTML, { headers: { 'Content-Type': 'text/html' } });
        if (path === '/api/login' && method === 'POST') return handleLogin(request, env);
        
        if (path.startsWith('/api/')) {
            // 鉴权检查
            if (isReadOnlyRequest(method, path)) {
                // GET请求允许访客
                if (path === '/api/materials' && method === 'GET') return handleQueryMaterials(request, env);
                if (path === '/api/suppliers' && method === 'GET') return handleSuppliers(request, env); // 新增允许读取供应商
            }

            const authResult = await authenticate(request, env);
            if (!authResult.authorized) {
                return method === 'GET' ? new Response('Unauthorized', { status: 404 }) : new Response('Unauthorized', { status: 401 });
            }
            
            // 路由表
            if (path === '/api/materials') return method === 'POST' ? handleCreateUpdateMaterial(request, env) : handleQueryMaterials(request, env);
            if (path.startsWith('/api/materials/') && method === 'DELETE') return handleDeleteMaterial(request, env);
            
            if (path === '/api/suppliers') return handleSuppliers(request, env); // 新增
            if (path.startsWith('/api/suppliers/') && method === 'DELETE') return handleDeleteSupplier(request, env); // 新增

            if (path === '/api/upload' && method === 'POST') return handleDirectUpload(request, env);
            if (path === '/api/import' && method === 'POST') return handleImportMaterials(request, env);
        }

        return new Response('Not Found', { status: 404 });
    }
};
