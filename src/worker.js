// src/worker.js
import * as jwt from '@tsndr/cloudflare-worker-jwt';

// --- 完整的内嵌前端 HTML/JS ---
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
        /* 导航栏样式 */
        .nav-tabs { margin-bottom: 20px; border-bottom: 1px solid #ddd; }
        .nav-btn {
            padding: 10px 20px; cursor: pointer; background: #e9ecef; border: none;
            border-radius: 5px 5px 0 0; margin-right: 5px; font-weight: bold;
        }
        .nav-btn.active { background: #007bff; color: white; }
        
        .section-card { 
            margin-bottom: 30px; 
            padding: 20px; 
            background-color: #fff;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
            border-radius: 8px;
            display: none; /* 默认隐藏，通过 JS 控制显示 */
        }
        .section-card.active { display: block; }

        input:not([type="file"]):not([type="checkbox"]):not([type="radio"]), select, textarea { 
            padding: 8px; margin: 5px 0; width: 100%; box-sizing: border-box;
            border: 1px solid #ccc; border-radius: 4px;
        }
        .form-group { margin-bottom: 10px; }
        .form-row { display: flex; gap: 20px; }
        .form-row > div { flex: 1; }
        
        button {
            padding: 10px 15px; margin: 5px; background-color: #28a745; color: white;
            border: none; border-radius: 4px; cursor: pointer; transition: background-color 0.3s ease;
        }
        button.delete-btn { background-color: #dc3545; }
        button.edit-btn { background-color: #ffc107; color: #333; }
        button:hover { opacity: 0.9; }
        
        table { width: 100%; border-collapse: collapse; margin-top: 20px; table-layout: fixed; }
        th, td { border: 1px solid #e0e0e0; padding: 8px; text-align: left; word-wrap: break-word; font-size: 0.9em; }
        th { background-color: #e9ecef; font-weight: bold; }
        
        .material-img { 
            max-width: 50px; max-height: 50px; object-fit: cover; border-radius: 4px;
            cursor: pointer; transition: opacity 0.3s;
        }
        .material-img:hover { opacity: 0.8; }
        .upload-controls { display: flex; gap: 5px; align-items: center; }
        .readonly-mode {
            background-color: #ffffe0; padding: 10px; margin-bottom: 20px;
            border-left: 5px solid #ffc107; font-weight: bold;
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
    
    <div id="main-container" style="display:none;">
        <div id="read-only-notice" class="readonly-mode" style="display:none;">
            您当前处于访客模式（只读）。所有编辑、删除、上传和导入功能已被禁用。
            <button onclick="handleLogout()" style="background-color: #007bff; margin-left: 20px;">返回登录</button>
        </div>
        <button onclick="handleLogout()" id="logout-btn" style="float: right; background-color: #dc3545;">退出登录</button>

        <div class="nav-tabs">
            <button class="nav-btn active" onclick="switchTab('materials')" id="tab-materials">📦 材料管理</button>
            <button class="nav-btn" onclick="switchTab('suppliers')" id="tab-suppliers">🏭 供应商管理</button>
        </div>

        <div id="view-materials" class="section-card active">
            
            <div id="manual-section">
                <h2>📝 创建 / 编辑材料 <button onclick="resetManualForm()" style="background-color: #17a2b8;">清空表单</button></h2>
                <form id="material-form">
                    <div class="form-row">
                        <div class="form-group">
                            <label for="f_unified_name">统一名称 *</label>
                            <input type="text" id="f_unified_name" name="unified_name" required>
                        </div>
                        <div class="form-group">
                            <label for="f_UID">唯一识别码 (UID) *</label>
                            <input type="text" id="f_UID" name="UID" required>
                        </div>
                         <div class="form-group">
                            <label for="f_supplier_id">供应商 (关联账号)</label>
                            <select id="f_supplier_id" name="supplier_id">
                                <option value="">(无供应商)</option>
                                </select>
                        </div>
                    </div>
                    
                    <div class="form-row">
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
                         <div class="form-group">
                            <label for="f_unit">单位</label>
                            <input type="text" id="f_unit" name="unit">
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="f_price">参考价格 (元)</label>
                            <input type="number" step="0.01" id="f_price" name="price" placeholder="0.00">
                        </div>
                         <div class="form-group" style="flex: 3;">
                            <label for="f_appearance">外观描述</label>
                            <input type="text" id="f_appearance" name="appearance" placeholder="例如：表面光滑、磨砂质感、带LOGO...">
                        </div>
                    </div>
                    
                    <div class="form-row">
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
                        <div class="form-group">
                            <label for="f_color">颜色</label>
                            <input type="text" id="f_color" name="color">
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="f_alias">别名</label>
                            <input type="text" id="f_alias" name="alias">
                        </div>
                        <div class="form-group" style="flex: 2;">
                            <label for="f_notes">备注信息</label>
                            <textarea id="f_notes" name="notes" rows="1" placeholder="使用说明等"></textarea>
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group" style="flex: 3;">
                            <label for="f_r2_image_key">R2 图片路径</label>
                            <div class="upload-controls">
                                <input type="text" id="f_r2_image_key" name="r2_image_key" placeholder="folder/image.jpg">
                                <input type="file" id="f_image_file" accept="image/*">
                                <button type="button" onclick="handleImageUpload()" id="upload-btn">上传</button>
                            </div>
                        </div>
                    </div>
                    
                    <button type="submit" id="save-btn" onclick="event.preventDefault(); handleSaveMaterial()">保存/更新材料记录</button>
                    <p id="manual-status" style="color: blue;"></p>
                </form>
            </div>

            <div id="import-section">
                <h3>📤 批量导入 (CSV/JSON)</h3>
                <input type="file" id="import-file" accept=".json, .csv">
                <button onclick="handleBulkImport()" id="import-btn">解析并导入</button>
                <p id="import-status" style="color: blue;"></p>
            </div>

            <div id="query-section">
                <h3>🔍 材料查询</h3>
                <input type="text" id="search-query" placeholder="输入名称、型号、UID或单位进行查询" style="width: 400px;">
                <button onclick="fetchMaterials()">查询</button>
                
                <table id="results-table">
                    <thead>
                        <tr>
                            <th width="50">图片</th>
                            <th>UID</th>
                            <th>统一名称</th>
                            <th>供应商</th> <th>价格</th>   <th>外观描述</th> <th>型号/规格</th>
                            <th>单位</th>
                            <th>备注</th> 
                            <th id="actions-header" width="120">操作</th>
                        </tr>
                    </thead>
                    <tbody id="results-body"></tbody>
                </table>
            </div>
        </div>

        <div id="view-suppliers" class="section-card">
            <h2>🏭 供应商管理</h2>
            <div style="margin-bottom: 20px; padding: 15px; background: #f9f9f9; border-radius: 5px;">
                <h4>添加/编辑 供应商</h4>
                <input type="hidden" id="s_id"> <div class="form-row">
                    <div class="form-group">
                        <label>供应商名称 *</label>
                        <input type="text" id="s_name" placeholder="例如: 晨光文具厂">
                    </div>
                    <div class="form-group">
                        <label>账号信息 / 联系方式</label>
                        <input type="text" id="s_account" placeholder="例如: 支付宝xxx / 电话138...">
                    </div>
                </div>
                <div class="form-group">
                    <label>备注</label>
                    <input type="text" id="s_notes" placeholder="付款周期、合作状态等">
                </div>
                <button onclick="handleSaveSupplier()">保存供应商</button>
                <button onclick="resetSupplierForm()" style="background-color: #6c757d;">重置</button>
                <p id="supplier-status"></p>
            </div>

            <h3>供应商列表</h3>
            <button onclick="fetchSuppliers()" style="background-color: #17a2b8; font-size: 0.8em;">刷新列表</button>
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>名称</th>
                        <th>账号/联系方式</th>
                        <th>备注</th>
                        <th width="120">操作</th>
                    </tr>
                </thead>
                <tbody id="supplier-body"></tbody>
            </table>
        </div>

    </div>

    <script>
        const API_BASE_URL = '/api'; 
        // 更新字段映射，加入新字段
        const FIELD_NAMES = [
            "unified_name", "material_type", "sub_category", "model_number", 
            "unit", "length_mm", "width_mm", "diameter_mm", "color", 
            "UID", "notes", "alias", "r2_image_key",
            "price", "appearance", "supplier_id" // <-- NEW FIELDS
        ];
        let isReadOnly = false;
        let allSuppliers = []; // 缓存供应商列表

        window.onload = function() {
            const token = localStorage.getItem('jwtToken');
            const guest = localStorage.getItem('isGuest');

            if (token) {
                isReadOnly = false;
                showMainSection();
                initData();
            } else if (guest === 'true') {
                isReadOnly = true;
                showMainSection();
                setReadOnlyMode();
                initData();
            }
        };

        function initData() {
            fetchSuppliers().then(() => {
                fetchMaterials(); // 加载完供应商后再加载材料，以便ID匹配名称
            });
        }
        
        function showMainSection() {
            document.getElementById('auth-section').style.display = 'none';
            document.getElementById('main-container').style.display = 'block';
        }

        function switchTab(tabName) {
            document.querySelectorAll('.section-card').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
            
            document.getElementById('view-' + tabName).classList.add('active');
            document.getElementById('tab-' + tabName).classList.add('active');
        }

        function setReadOnlyMode() {
            isReadOnly = true;
            document.getElementById('manual-section').style.display = 'none';
            document.getElementById('import-section').style.display = 'none';
            document.getElementById('logout-btn').style.display = 'none';
            document.getElementById('read-only-notice').style.display = 'block';
            // 隐藏供应商管理入口
            document.getElementById('tab-suppliers').style.display = 'none';
        }

        function getAuthHeaders() {
            return {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('jwtToken')
            };
        }

        // --- 1. 供应商管理逻辑 ---

        async function fetchSuppliers() {
            if (isReadOnly) return; 
            try {
                const res = await fetch(API_BASE_URL + '/suppliers', { headers: getAuthHeaders() });
                if (res.ok) {
                    allSuppliers = await res.json();
                    renderSupplierTable();
                    updateSupplierDropdown();
                }
            } catch (e) { console.error("Fetch Suppliers failed", e); }
        }

        function renderSupplierTable() {
            const tbody = document.getElementById('supplier-body');
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
            select.innerHTML = '<option value="">(无供应商)</option>';
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
        }

        function resetSupplierForm() {
            document.getElementById('s_id').value = '';
            document.getElementById('s_name').value = '';
            document.getElementById('s_account').value = '';
            document.getElementById('s_notes').value = '';
            document.getElementById('supplier-status').textContent = '';
        }

        async function handleSaveSupplier() {
            if (isReadOnly) return;
            const id = document.getElementById('s_id').value;
            const name = document.getElementById('s_name').value;
            if (!name) return alert('请输入供应商名称');

            const data = {
                id: id ? parseInt(id) : null,
                name: name,
                account_info: document.getElementById('s_account').value,
                notes: document.getElementById('s_notes').value
            };

            const status = document.getElementById('supplier-status');
            try {
                const res = await fetch(API_BASE_URL + '/suppliers', {
                    method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(data)
                });
                if (res.ok) {
                    resetSupplierForm();
                    fetchSuppliers();
                    status.textContent = '保存成功'; status.style.color = 'green';
                } else {
                    status.textContent = '保存失败'; status.style.color = 'red';
                }
            } catch (e) { alert('Error: ' + e.message); }
        }

        async function deleteSupplier(id) {
            if (!confirm('确定删除此供应商吗？已分配此供应商的材料将不再显示供应商名称。')) return;
            try {
                await fetch(\`\${API_BASE_URL}/suppliers/\${id}\`, { method: 'DELETE', headers: getAuthHeaders() });
                fetchSuppliers();
            } catch (e) { alert('Error'); }
        }

        // --- 2. 材料管理逻辑 (Updated) ---

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

        async function handleSaveMaterial() {
            if (isReadOnly) return alert('访客模式下禁止操作。');
            const data = getFormData();
            if (!data.UID || !data.unified_name) return alert('UID 和 统一名称 不能为空。');

            const status = document.getElementById('manual-status');
            status.textContent = '正在保存...';

            try {
                const response = await fetch(\`\${API_BASE_URL}/materials\`, {
                    method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(data)
                });
                const result = await response.json();
                if (response.ok) {
                    status.textContent = \`记录 \${result.uid} 保存成功！\`;
                    status.style.color = 'green';
                    fetchMaterials(); 
                } else {
                    status.textContent = \`失败: \${result.message}\`;
                }
            } catch (error) {
                status.textContent = '错误: ' + error.message;
            }
        }

        async function fetchMaterials() {
            const query = document.getElementById('search-query').value;
            const token = localStorage.getItem('jwtToken'); 
            const body = document.getElementById('results-body');
            body.innerHTML = '<tr><td colspan="10" style="text-align: center;">正在查询...</td></tr>';

            try {
                const response = await fetch(\`\${API_BASE_URL}/materials?q=\${encodeURIComponent(query)}\`, {
                    headers: token ? { 'Authorization': 'Bearer ' + token } : {} 
                });
                if (response.ok) {
                    const materials = await response.json();
                    renderMaterials(materials);
                } else {
                    body.innerHTML = '<tr><td colspan="10" style="text-align: center; color: red;">查询失败</td></tr>';
                }
            } catch (error) {
                console.error(error);
            }
        }

        function renderMaterials(materials) {
            const body = document.getElementById('results-body');
            body.innerHTML = ''; 
            
            if (materials.length === 0) {
                body.innerHTML = \`<tr><td colspan="10" style="text-align: center;">未找到数据。</td></tr>\`;
                return;
            }

            materials.forEach(mat => {
                const row = body.insertRow();
                
                // 组合尺寸字符串
                let dim = [];
                if(mat.length_mm) dim.push(\`L:\${mat.length_mm}\`);
                if(mat.width_mm) dim.push(\`W:\${mat.width_mm}\`);
                if(mat.diameter_mm) dim.push(\`Ø:\${mat.diameter_mm}\`);
                if(mat.model_number) dim.unshift(mat.model_number);
                const dimStr = dim.join(' ') || '-';

                const cleanMat = JSON.stringify(mat).replace(/'/g, "\\\\'"); 

                // 图片
                const imgCell = row.insertCell();
                if (mat.image_url) {
                    imgCell.innerHTML = \`<a href="\${mat.image_url}" target="_blank"><img src="\${mat.image_url}" class="material-img"></a>\`;
                } else { imgCell.textContent = '-'; }

                row.insertCell().textContent = mat.UID;
                row.insertCell().textContent = mat.unified_name;
                // 供应商显示名称，而不是ID
                row.insertCell().innerHTML = mat.supplier_name ? \`<span style="color:#007bff">\${mat.supplier_name}</span>\` : '-';
                // 价格
                row.insertCell().textContent = mat.price ? '¥' + mat.price.toFixed(2) : '-';
                // 外观
                row.insertCell().textContent = mat.appearance || '-';
                
                row.insertCell().textContent = dimStr;
                row.insertCell().textContent = mat.unit || '-';
                row.insertCell().textContent = mat.notes || '-';

                // 操作
                const actionsCell = row.insertCell();
                if (!isReadOnly) {
                    actionsCell.innerHTML = \`
                        <button class="edit-btn" onclick='handleEdit(\${cleanMat})'>编辑</button>
                        <button class="delete-btn" onclick="handleDelete('\${mat.UID}')">删除</button>
                    \`;
                } else {
                    actionsCell.textContent = '-';
                    if(document.getElementById('actions-header')) document.getElementById('actions-header').style.display = 'none';
                    actionsCell.style.display = 'none';
                }
            });
        }

        function handleEdit(material) {
            if (isReadOnly) return;
            switchTab('materials');
            // 填充表单
            FIELD_NAMES.forEach(name => {
                const element = document.getElementById('f_' + name);
                if (element && material[name] !== undefined) {
                    element.value = material[name];
                }
            });
            document.getElementById('f_UID').disabled = true; 
            document.getElementById('manual-status').textContent = '正在编辑: ' + material.UID;
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        function resetManualForm() {
            document.getElementById('material-form').reset();
            document.getElementById('f_UID').disabled = false;
            document.getElementById('manual-status').textContent = '';
        }

        // 图片上传、批量导入、删除、登录注销等功能与之前保持一致
        // ... (此处省略未修改的通用函数，以节省长度，它们直接调用之前的逻辑即可) ...
        // 注意：为了完整性，你需要确保 handleImageUpload, handleBulkImport, handleDelete, handleLogin, handleLogout 等函数依然存在于此 script 标签内
        // 简写示例：
        async function handleImageUpload() { /* 同上一版逻辑 */ 
             const fileInput = document.getElementById('f_image_file');
             const keyInput = document.getElementById('f_r2_image_key');
             const status = document.getElementById('manual-status');
             const token = localStorage.getItem('jwtToken');
             if (!fileInput.files[0] || !token) return;
             
             const formData = new FormData();
             const r2Key = keyInput.value || \`uploads/\${Date.now()}/\${fileInput.files[0].name}\`;
             formData.append('file', fileInput.files[0]);
             formData.append('key', r2Key);
             
             try {
                 const res = await fetch(API_BASE_URL+'/upload', { method:'POST', headers:{'Authorization':'Bearer '+token}, body:formData });
                 const json = await res.json();
                 if(json.status==='success') { keyInput.value = r2Key; status.textContent = '图片上传成功'; }
             } catch(e) { alert('Upload failed'); }
        }

        async function handleBulkImport() { /* 同上一版逻辑, 记得让 CSV 解析器能处理新字段 */
             // 简单 CSV 解析逻辑需要包含 price, appearance, supplier_id
             const fileInput = document.getElementById('import-file');
             if(!fileInput.files[0]) return;
             const reader = new FileReader();
             reader.onload = async (e) => {
                 // 这里简化处理，假设用户上传 JSON，或者 CSV 包含相应表头
                 let data = [];
                 if(fileInput.files[0].name.endsWith('.json')) data = JSON.parse(e.target.result);
                 // CSV解析逻辑略，建议使用库或保留原有的 parseCSV 但增加字段映射
                 
                 const res = await fetch(API_BASE_URL+'/import', {
                     method:'POST', headers: getAuthHeaders(), body: JSON.stringify(data)
                 });
                 const result = await res.json();
                 alert(result.message || '导入完成');
                 fetchMaterials();
             };
             reader.readAsText(fileInput.files[0]);
        }

        async function handleDelete(uid) { /* 同上一版逻辑 */
            if(!confirm('Confirm delete?')) return;
            await fetch(\`\${API_BASE_URL}/materials/\${uid}\`, { method:'DELETE', headers: getAuthHeaders() });
            fetchMaterials();
        }

        async function handleLogin() { /* 同上一版逻辑 */
            const u = document.getElementById('username').value;
            const p = document.getElementById('password').value;
            const res = await fetch(API_BASE_URL+'/login', { method:'POST', body:JSON.stringify({username:u, password:p}) });
            if(res.ok) {
                const data = await res.json();
                localStorage.setItem('jwtToken', data.token);
                location.reload();
            } else { alert('Login failed'); }
        }
        function handleLogout() { localStorage.removeItem('jwtToken'); localStorage.removeItem('isGuest'); location.reload(); }
        function handleViewAsGuest() { localStorage.setItem('isGuest', 'true'); location.reload(); }

    </script>
</body>
</html>
`;

// --- 后端逻辑 ---

// Helper: R2 URL
function getPublicImageUrl(r2_key, env) {
    if (!r2_key || !env.R2_PUBLIC_DOMAIN) return null;
    return `${env.R2_PUBLIC_DOMAIN}/${r2_key}`;
}

// Auth Middleware
async function authenticate(request, env) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { authorized: false, status: 401 }; 
    }
    try {
        const isValid = await jwt.verify(authHeader.split(' ')[1], env.JWT_SECRET);
        return isValid ? { authorized: true } : { authorized: false, status: 403 };
    } catch (e) { return { authorized: false, status: 403 }; }
}

// --- API Handlers ---

// 1. Suppliers API (New)
async function handleSuppliers(request, env) {
    if (!env.DB) return new Response('DB missing', { status: 500 });
    const method = request.method;
    
    if (method === 'GET') {
        const { results } = await env.DB.prepare("SELECT * FROM suppliers ORDER BY id DESC").all();
        return new Response(JSON.stringify(results), { headers: { 'Content-Type': 'application/json' } });
    }
    
    if (method === 'POST') {
        const data = await request.json();
        if (!data.name) return new Response('Name required', { status: 400 });
        
        if (data.id) {
            // Update
            await env.DB.prepare("UPDATE suppliers SET name=?, account_info=?, notes=? WHERE id=?")
                .bind(data.name, data.account_info, data.notes, data.id).run();
        } else {
            // Insert
            await env.DB.prepare("INSERT INTO suppliers (name, account_info, notes) VALUES (?, ?, ?)")
                .bind(data.name, data.account_info, data.notes).run();
        }
        return new Response(JSON.stringify({ status: 'success' }), { headers: { 'Content-Type': 'application/json' } });
    }
    
    return new Response('Method not allowed', { status: 405 });
}

async function handleDeleteSupplier(request, env) {
    const url = new URL(request.url);
    const id = url.pathname.split('/').pop();
    await env.DB.prepare("DELETE FROM suppliers WHERE id = ?").bind(id).run();
    // Optional: Set supplier_id to NULL for materials linked to this supplier
    await env.DB.prepare("UPDATE materials SET supplier_id = NULL WHERE supplier_id = ?").bind(id).run();
    return new Response(JSON.stringify({ status: 'success' }), { headers: { 'Content-Type': 'application/json' } });
}

// 2. Materials API (Updated)
async function handleCreateUpdateMaterial(request, env) {
    const mat = await request.json();
    if (!mat.UID || !mat.unified_name) return new Response(JSON.stringify({ message: 'Missing UID/Name' }), { status: 400 });

    try {
        // 增加了 price, appearance, supplier_id
        const stmt = env.DB.prepare(`
            INSERT OR REPLACE INTO materials 
            (UID, unified_name, material_type, sub_category, model_number, length_mm, width_mm, diameter_mm, color, notes, alias, r2_image_key, unit, price, appearance, supplier_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            mat.UID, mat.unified_name, mat.material_type, mat.sub_category, mat.model_number, 
            mat.length_mm, mat.width_mm, mat.diameter_mm, 
            mat.color, mat.notes, mat.alias, mat.r2_image_key, mat.unit,
            mat.price || null, 
            mat.appearance || null,
            mat.supplier_id || null
        );

        await stmt.run();
        return new Response(JSON.stringify({ status: 'success', uid: mat.UID }), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
        return new Response(JSON.stringify({ message: e.message }), { status: 500 });
    }
}

async function handleQueryMaterials(request, env) {
    const url = new URL(request.url);
    const query = url.searchParams.get('q') || '';
    let stmt;
    
    // 使用 LEFT JOIN 连接 suppliers 表以获取供应商名称
    const baseSQL = `
        SELECT m.*, s.name as supplier_name 
        FROM materials m 
        LEFT JOIN suppliers s ON m.supplier_id = s.id
    `;

    if (query) {
        const pattern = `%${query}%`;
        stmt = env.DB.prepare(`${baseSQL} WHERE m.UID LIKE ? OR m.unified_name LIKE ? OR m.model_number LIKE ? OR s.name LIKE ? LIMIT 100`)
            .bind(pattern, pattern, pattern, pattern);
    } else {
        stmt = env.DB.prepare(`${baseSQL} LIMIT 100`);
    }

    const { results } = await stmt.all();
    const data = results.map(mat => ({
        ...mat,
        image_url: getPublicImageUrl(mat.r2_image_key, env)
    }));

    return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
}

// Import 和 Login 逻辑保持基本不变，只需在 Import 中处理新字段
async function handleImportMaterials(request, env) {
    const materials = await request.json();
    if (!Array.isArray(materials)) return new Response('Invalid array', { status: 400 });

    const statements = materials.map(mat => {
        return env.DB.prepare(`
            INSERT OR REPLACE INTO materials 
            (UID, unified_name, material_type, sub_category, model_number, length_mm, width_mm, diameter_mm, color, notes, alias, r2_image_key, unit, price, appearance, supplier_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            mat.UID, mat.unified_name, mat.material_type, mat.sub_category, mat.model_number, 
            mat.length_mm, mat.width_mm, mat.diameter_mm, mat.color, mat.notes, mat.alias, mat.r2_image_key, mat.unit,
            mat.price, mat.appearance, mat.supplier_id
        );
    });
    
    await env.DB.batch(statements);
    return new Response(JSON.stringify({ status: 'success', count: materials.length }), { headers: { 'Content-Type': 'application/json' } });
}

// Login, Upload, Delete Material 逻辑复用原有代码（此处为了节省篇幅省略，实际部署时请保留）
// 简单占位：
async function handleLogin(req, env) { 
    const { username, password } = await req.json();
    // 简单的硬编码验证用于演示，请保留你原有的数据库验证逻辑
    if(username==='test' && password==='testpass') {
         return new Response(JSON.stringify({ token: await jwt.sign({u:'admin'}, env.JWT_SECRET) }));
    }
    return new Response('Fail', {status:401});
}
async function handleDirectUpload(req, env) {
    const formData = await req.formData();
    await env.R2_MEDIA.put(formData.get('key'), formData.get('file'));
    return new Response(JSON.stringify({status:'success'}));
}
async function handleDeleteMaterial(req, env) {
    const uid = req.url.split('/').pop();
    await env.DB.prepare("DELETE FROM materials WHERE UID=?").bind(uid).run();
    return new Response(JSON.stringify({status:'success'}));
}


export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method;
        const headers = { 'Access-Control-Allow-Origin': '*' };

        if (path === '/') return new Response(FRONTEND_HTML, { headers: { 'Content-Type': 'text/html' } });
        if (path === '/api/login') return handleLogin(request, env);

        // Auth check
        if (path.startsWith('/api/')) {
            if (method !== 'GET' && method !== 'OPTIONS') {
                const auth = await authenticate(request, env);
                if (!auth.authorized) return new Response('Unauthorized', { status: 401 });
            }
            
            // Material Routes
            if (path === '/api/materials') {
                return method === 'POST' ? handleCreateUpdateMaterial(request, env) : handleQueryMaterials(request, env);
            }
            if (path.startsWith('/api/materials/')) return handleDeleteMaterial(request, env);
            if (path === '/api/import') return handleImportMaterials(request, env);
            if (path === '/api/upload') return handleDirectUpload(request, env);

            // Supplier Routes (New)
            if (path === '/api/suppliers') return handleSuppliers(request, env);
            if (path.startsWith('/api/suppliers/')) return handleDeleteSupplier(request, env);
        }

        return new Response('Not Found', { status: 404 });
    }
};
