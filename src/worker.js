// src/worker.js
import * as jwt from '@tsndr/cloudflare-worker-jwt';

// --- 完整的内嵌前端 HTML/JS (已更新布局、访客逻辑和字段顺序, 包含供应商管理) ---
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
        #query-section, #auth-section, #import-section, #manual-section, #admin-tools-section, #supplier-price-section { 
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
        button {
            background-color: #007bff;
            color: white;
            padding: 10px 15px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            transition: background-color 0.3s;
        }
        button:hover { background-color: #0056b3; }
        #results-table, #supplier-results-table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 20px;
        }
        #results-table th, #results-table td, #supplier-results-table th, #supplier-results-table td { 
            border: 1px solid #ddd; 
            padding: 8px; 
            text-align: left;
            vertical-align: middle;
        }
        #results-table th, #supplier-results-table th { 
            background-color: #f2f2f2; 
            font-weight: bold;
        }
        .material-img {
            max-width: 50px;
            max-height: 50px;
            display: block;
            margin: 0 auto;
        }
        .form-group {
            flex-grow: 1;
            padding: 0 10px;
            min-width: 180px;
        }
        .form-row {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-bottom: 10px;
            align-items: flex-end;
        }
        .action-button { margin-left: 10px; }
        .delete-btn { background-color: #dc3545; }
        .delete-btn:hover { background-color: #c82333; }
        .edit-btn { background-color: #ffc107; color: #333; }
        .edit-btn:hover { background-color: #e0a800; }
        
        @media (max-width: 768px) {
            .form-row { flex-direction: column; }
            .form-group { padding: 0; }
        }
    </style>
</head>
<body>

    <h1>小学教育材料统一数据库 - 管理端</h1>
    
    <div id="auth-section">
        <h2>🔑 登录</h2>
        <p id="read-only-notice" style="color: gray;">当前为访客（只读）模式。如需操作，请登录。</p>
        <div id="login-form">
            <div class="form-row">
                <div class="form-group"><label>用户名</label><input type="text" id="username" value="test"></div>
                <div class="form-group"><label>密码</label><input type="password" id="password" value="testpass"></div>
                <button onclick="handleLogin()">登录</button>
            </div>
            <button id="logout-btn" onclick="handleLogout()" style="background-color: #6c757d; display: none;">登出</button>
            <p id="auth-status" style="color: blue; margin-top: 10px;"></p>
        </div>
    </div>
    
    <div id="main-section" style="display: none;">
        
        <div id="admin-tools-section" style="display: none;">
            <h2>🛠️ 管理员工具</h2>

            <div style="border: 1px solid #007bff; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
                <h3>👤 创建供应商账户</h3>
                <div class="form-row">
                    <div class="form-group"><label>公司名称</label><input type="text" id="sup_company_name" placeholder="例如: XX科技公司"></div>
                    <div class="form-group"><label>登录用户名</label><input type="text" id="sup_username" placeholder="供应商登录名"></div>
                    <div class="form-group"><label>登录密码</label><input type="password" id="sup_password" placeholder="初始密码"></div>
                    <button onclick="handleCreateSupplierAccount()" style="margin-top: 25px; background-color: #007bff;">创建账户</button>
                </div>
                <p id="supplier-create-status" style="color: blue;"></p>
            </div>

            <div style="border: 1px solid #28a745; padding: 15px; border-radius: 6px;">
                <h3>🔗 材料分配供应商</h3>
                <div class="form-row">
                    <div class="form-group"><label>材料 UID *</label><input type="text" id="assign_uid" placeholder="要分配的材料 UID"></div>
                    <div class="form-group"><label>选择供应商 *</label>
                        <select id="assign_supplier_uuid">
                            <option value="">-- 请选择供应商 --</option>
                            </select>
                    </div>
                    <button onclick="handleAssignMaterial()" style="margin-top: 25px; background-color: #28a745;">分配材料</button>
                </div>
                <p id="assign-status" style="color: blue;"></p>
            </div>
        </div>
        
        <div id="supplier-price-section" style="display:none;">
            <h2>💵 价格更新中心 - <span id="supplier-company-name"></span></h2>
            <table id="supplier-results-table">
                <thead>
                    <tr>
                        <th style="width: 5%;">图片</th>
                        <th style="width: 25%;">统一名称</th>
                        <th style="width: 15%;">型号</th>
                        <th style="width: 10%;">单位</th>
                        <th style="width: 15%;">当前报价 (元)</th>
                        <th style="width: 15%;">最新更新</th>
                        <th style="width: 15%;">更新价格</th>
                    </tr>
                </thead>
                <tbody id="supplier-results-body">
                    <tr><td colspan="7" style="text-align: center;">请登录或联系管理员。</td></tr>
                </tbody>
            </table>
        </div>

        <div id="manual-section">
            <h2>✍️ 材料手动录入 / 修改</h2>
            <p style="color: gray;">UID 为空时新建，UID 存在时修改。</p>
            <div class="form-row">
                <div class="form-group"><label>UID (唯一标识)</label><input type="text" id="UID" placeholder="M-0001"></div>
                <div class="form-group"><label>统一名称 *</label><input type="text" id="unified_name" placeholder="例如: 智能机器人"></div>
                <div class="form-group"><label>型号 *</label><input type="text" id="model_number" placeholder="XYZ-2023"></div>
                <div class="form-group"><label>单位 *</label><input type="text" id="unit" placeholder="套/个"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>来源</label><input type="text" id="source" placeholder="供应商名称/品牌"></div>
                <div class="form-group"><label>数量/规格</label><input type="text" id="quantity_spec" placeholder="10套/50cm"></div>
                <div class="form-group"><label>用途</label><input type="text" id="purpose" placeholder="科学实验/教学用"></div>
                <div class="form-group"><label>存放地点</label><input type="text" id="storage_location" placeholder="A栋仓库-3层"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>备注</label><input type="text" id="notes" placeholder="关键技术参数"></div>
                <div class="form-group"><label>图片上传</label><input type="file" id="image_upload"></div>
                <div class="form-group" id="image_preview_group"><label>当前图片 (R2 Key)</label><input type="text" id="r2_image_key" readonly placeholder="图片上传后自动生成 R2 Key"></div>
            </div>
            <div class="form-row">
                <button onclick="handleSave()">保存 / 更新</button>
                <button onclick="clearForm()" style="background-color: #6c757d;">清空</button>
            </div>
            <p id="manual-status" style="color: blue; margin-top: 10px;"></p>
        </div>

        <div id="import-section">
            <h2>批量导入 (CSV)</h2>
            <input type="file" id="csv_file" accept=".csv" style="margin-bottom: 10px;">
            <button onclick="handleImport()">上传并导入</button>
            <p id="import-status" style="color: blue; margin-top: 10px;"></p>
            <p style="color: gray; font-size: 0.9em;">文件格式：必须包含 UID,unified_name,model_number,unit,source,quantity_spec,purpose,storage_location,notes</p>
        </div>

        <div id="query-section">
            <h2>🔍 材料查询</h2>
            <div class="form-row">
                <div class="form-group"><label>关键词 (名称/型号/用途/备注)</label><input type="text" id="query_keyword" placeholder="例如: 机器人或 XYZ-2023"></div>
                <button onclick="fetchMaterials()">查询</button>
            </div>
            
            <table id="results-table">
                <thead>
                    <tr>
                        <th style="width: 5%;">图片</th>
                        <th style="width: 10%;">UID</th>
                        <th style="width: 15%;">名称</th>
                        <th style="width: 10%;">型号</th>
                        <th style="width: 5%;">单位</th>
                        <th style="width: 10%;">来源</th>
                        <th style="width: 10%;">数量/规格</th>
                        <th style="width: 10%;">用途</th>
                        <th style="width: 15%;">存放地点</th>
                        <th id="actions-header" style="width: 10%;">操作</th>
                    </tr>
                </thead>
                <tbody id="results-body">
                    <tr><td colspan="10" style="text-align: center;">输入关键词或点击查询按钮加载数据。</td></tr>
                </tbody>
            </table>
        </div>
    </div>

    <script>
        const API_BASE_URL = '/api'; 
        const FIELD_NAMES = [
            'UID', 'unified_name', 'model_number', 'unit', 'source', 
            'quantity_spec', 'purpose', 'storage_location', 'notes'
        ];
        let isReadOnly = true;
        let currentUserRole = null; // 【新增】当前用户角色: admin, supplier, null
        let currentSupplierUUID = null; // 【新增】当前供应商 UUID
        let allSuppliers = []; // 存储所有供应商列表

        // --- 辅助函数 ---
        function getAuthHeaders() {
            const token = localStorage.getItem('jwtToken');
            const headers = {
                'Content-Type': 'application/json'
            };
            if (token) {
                headers['Authorization'] = \`Bearer \${token}\`;
            }
            return headers;
        }

        function showMainSection() {
            document.getElementById('auth-section').style.display = 'none';
            document.getElementById('main-section').style.display = 'block';
        }
        
        function hideMainSection() {
            document.getElementById('auth-section').style.display = 'block';
            document.getElementById('main-section').style.display = 'none';
        }

        function clearForm() {
            FIELD_NAMES.forEach(id => {
                document.getElementById(id).value = '';
            });
            document.getElementById('r2_image_key').value = '';
            document.getElementById('image_upload').value = '';
        }

        function loadForm(material) {
            clearForm();
            FIELD_NAMES.forEach(id => {
                const value = material[id] || '';
                document.getElementById(id).value = value;
            });
            document.getElementById('r2_image_key').value = material.r2_image_key || '';
        }

        // --- 权限/模式切换 ---
        function setAdminMode() {
            // 显示管理员工具
            document.getElementById('admin-tools-section').style.display = 'block';
            document.getElementById('manual-section').style.display = 'block';
            document.getElementById('import-section').style.display = 'block';
            document.getElementById('query-section').style.display = 'block';
            document.getElementById('supplier-price-section').style.display = 'none';
            document.getElementById('logout-btn').style.display = 'block';
            document.getElementById('actions-header').style.display = 'table-cell'; 
            document.getElementById('read-only-notice').style.display = 'none';
            fetchSuppliers(); // 刷新供应商列表
            fetchMaterials(); // 刷新材料列表
        }

        async function setSupplierMode() {
            // 隐藏管理员工具和材料 CRUD
            document.getElementById('admin-tools-section').style.display = 'none';
            document.getElementById('manual-section').style.display = 'none';
            document.getElementById('import-section').style.display = 'none';
            document.getElementById('query-section').style.display = 'none'; 
            
            // 显示供应商价格更新界面
            document.getElementById('supplier-price-section').style.display = 'block';
            document.getElementById('logout-btn').style.display = 'block';
            document.getElementById('read-only-notice').style.display = 'none';
            
            await fetchSupplierMaterials(); // 仅查询该供应商负责的材料
        }


        // --- 认证与登录 ---
        function checkAuthStatus() {
            const token = localStorage.getItem('jwtToken');
            const isGuest = localStorage.getItem('isGuest') !== 'false';

            if (token) {
                // 尝试解码 Token 来获取角色信息 (简单前端判断，实际后端会校验)
                try {
                    const payloadBase64 = token.split('.')[1];
                    const payloadJson = atob(payloadBase64);
                    const payload = JSON.parse(payloadJson);
                    currentUserRole = payload.role;
                    currentSupplierUUID = payload.supplier_uuid;
                    isReadOnly = false;
                    
                    showMainSection();
                    document.getElementById('read-only-notice').style.display = 'none';
                    
                    if (currentUserRole === 'supplier') {
                        setSupplierMode();
                    } else {
                        setAdminMode();
                    }

                } catch (e) {
                    console.error("Token decode error:", e);
                    handleLogout(); // 无效 Token，强制登出
                }
            } else {
                handleLogout(); // 未登录，进入访客模式
            }
        }
        
        async function handleLogin() {
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const status = document.getElementById('auth-status');
            status.textContent = '正在登录...';
            status.style.color = 'blue';

            try {
                const response = await fetch(\`\${API_BASE_URL}/login\`\, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                if (response.ok) {
                    const data = await response.json();
                    localStorage.setItem('jwtToken', data.token);
                    localStorage.removeItem('isGuest'); 
                    
                    // 【关键】存储角色信息
                    currentUserRole = data.role;
                    currentSupplierUUID = data.supplier_uuid;
                    
                    status.textContent = \`登录成功！(\${data.role === 'admin' ? '管理员' : '供应商'}模式)\`;
                    status.style.color = 'green';
                    
                    isReadOnly = false;
                    
                    // 根据角色显示不同界面
                    showMainSection();
                    if (currentUserRole === 'supplier') {
                        setSupplierMode();
                    } else {
                        setAdminMode();
                    }

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
            localStorage.setItem('isGuest', 'true');
            isReadOnly = true;
            currentUserRole = null;
            currentSupplierUUID = null;
            document.getElementById('logout-btn').style.display = 'none';
            document.getElementById('read-only-notice').style.display = 'block';
            document.getElementById('manual-section').style.display = 'none';
            document.getElementById('import-section').style.display = 'none';
            document.getElementById('admin-tools-section').style.display = 'none';
            document.getElementById('supplier-price-section').style.display = 'none';
            document.getElementById('actions-header').style.display = 'none';
            hideMainSection();
            fetchMaterials(); // 重新加载只读数据
        }
        
        // --- 材料 CRUD 操作 ---
        
        async function uploadImage(file) {
            const status = document.getElementById('manual-status');
            const token = localStorage.getItem('jwtToken');
            if (!token) {
                status.textContent = '请先登录。'; status.style.color = 'red'; return null;
            }
            
            try {
                const formData = new FormData();
                formData.append('file', file);

                const response = await fetch(\`\${API_BASE_URL}/upload\`\, {
                    method: 'POST',
                    headers: { 'Authorization': \`Bearer \${token}\` }, // 注意：这里不设 Content-Type，让 fetch 自动设置 boundary
                    body: formData
                });

                if (response.ok) {
                    const result = await response.json();
                    return result.key;
                } else {
                    const errorText = await response.text();
                    status.textContent = '图片上传失败: ' + errorText;
                    status.style.color = 'red';
                    return null;
                }
            } catch (error) {
                status.textContent = '网络错误，图片上传失败: ' + error.message;
                status.style.color = 'red';
                return null;
            }
        }
        
        async function handleSave() {
            if (isReadOnly) {
                document.getElementById('manual-status').textContent = '访客模式下无法执行此操作。';
                document.getElementById('manual-status').style.color = 'red';
                return;
            }

            const data = {};
            FIELD_NAMES.forEach(id => {
                data[id] = document.getElementById(id).value.trim();
            });
            data.r2_image_key = document.getElementById('r2_image_key').value.trim();
            
            // 检查必填字段
            if (!data.unified_name || !data.model_number || !data.unit) {
                document.getElementById('manual-status').textContent = '统一名称、型号、单位为必填项。';
                document.getElementById('manual-status').style.color = 'red';
                return;
            }
            
            const imageFile = document.getElementById('image_upload').files[0];
            const status = document.getElementById('manual-status');
            status.textContent = '正在处理...'; status.style.color = 'blue';

            // 1. 处理图片上传
            if (imageFile) {
                status.textContent = '正在上传图片...';
                const key = await uploadImage(imageFile);
                if (key) {
                    data.r2_image_key = key;
                    document.getElementById('r2_image_key').value = key; // 更新表单
                } else {
                    // 上传失败，停止保存操作
                    return;
                }
            }

            // 2. 保存材料数据
            status.textContent = '正在保存材料数据...';
            
            try {
                const response = await fetch(\`\${API_BASE_URL}/materials\`\, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(data)
                });
                
                const result = await response.json();

                if (response.ok) {
                    status.textContent = '保存成功！UID: ' + result.UID;
                    status.style.color = 'green';
                    document.getElementById('UID').value = result.UID; // 更新表单的UID
                    fetchMaterials(); // 刷新列表
                } else {
                    status.textContent = '保存失败: ' + (result.message || response.statusText);
                    status.style.color = 'red';
                }

            } catch (error) {
                status.textContent = '网络错误，保存失败: ' + error.message;
                status.style.color = 'red';
            }
        }

        async function handleDelete(UID) {
            if (!confirm(\`确定要删除 UID 为 \${UID} 的材料吗？\`)) return;
            
            const status = document.getElementById('manual-status');
            status.textContent = \`正在删除 \${UID}...\`; status.style.color = 'blue';

            try {
                const response = await fetch(\`\${API_BASE_URL}/materials/\${UID}\`\, {
                    method: 'DELETE',
                    headers: getAuthHeaders()
                });
                
                const result = await response.json();

                if (response.ok) {
                    status.textContent = \`材料 \${UID} 删除成功。\`;
                    status.style.color = 'green';
                    fetchMaterials(); // 刷新列表
                    if (document.getElementById('UID').value === UID) clearForm();
                } else {
                    status.textContent = '删除失败: ' + (result.message || response.statusText);
                    status.style.color = 'red';
                }

            } catch (error) {
                status.textContent = '网络错误，删除失败: ' + error.message;
                status.style.color = 'red';
            }
        }
        
        // --- 批量导入 ---
        async function handleImport() {
            if (isReadOnly) {
                document.getElementById('import-status').textContent = '访客模式下无法执行此操作。';
                document.getElementById('import-status').style.color = 'red';
                return;
            }
            
            const fileInput = document.getElementById('csv_file');
            const file = fileInput.files[0];
            const status = document.getElementById('import-status');

            if (!file) {
                status.textContent = '请选择一个 CSV 文件。'; status.style.color = 'red'; return;
            }

            status.textContent = '正在上传并导入...'; status.style.color = 'blue';

            try {
                const formData = new FormData();
                formData.append('csv_file', file);

                const response = await fetch(\`\${API_BASE_URL}/import\`\, {
                    method: 'POST',
                    headers: { 'Authorization': getAuthHeaders()['Authorization'] }, 
                    body: formData
                });

                const result = await response.json();

                if (response.ok && result.status === 'success') {
                    status.textContent = \`导入成功！新增 \${result.importedCount} 条记录，更新 \${result.updatedCount} 条记录。\`;
                    status.style.color = 'green';
                    fetchMaterials();
                } else {
                    status.textContent = \`导入失败: \${result.message || response.statusText}\`;
                    status.style.color = 'red';
                }

            } catch (error) {
                status.textContent = '网络错误，导入失败: ' + error.message;
                status.style.color = 'red';
            }
        }

        // --- 查询与渲染 ---
        async function fetchMaterials() {
            const keyword = document.getElementById('query_keyword').value;
            const body = document.getElementById('results-body');
            body.innerHTML = '<tr><td colspan="10" style="text-align: center;">正在查询...</td></tr>';

            let url = \`\${API_BASE_URL}/materials\`\;
            if (keyword) {
                url += \`\?keyword=\${encodeURIComponent(keyword)}\`\;
            }
            
            try {
                // 访客模式下不带 Auth Header
                const headers = isReadOnly ? {} : getAuthHeaders();
                
                const response = await fetch(url, { headers });
                
                if (response.ok) {
                    const materials = await response.json();
                    renderMaterials(materials);
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
                body.innerHTML = '<tr><td colspan="10" style="text-align: center;">未找到符合条件的材料。</td></tr>';
                return;
            }

            // 访客模式下隐藏操作列
            document.getElementById('actions-header').style.display = isReadOnly ? 'none' : 'table-cell';
            
            materials.forEach(mat => {
                const row = body.insertRow();
                
                // 1. 图片
                const imgCell = row.insertCell();
                if (mat.image_url) {
                    imgCell.innerHTML = \`\<a href="\${mat.image_url}" target="_blank"><img src="\${mat.image_url}" class="material-img" alt="\${mat.unified_name}"></a>\`\;
                } else {
                    imgCell.textContent = '-';
                }
                
                row.insertCell().textContent = mat.UID || '-';
                row.insertCell().textContent = mat.unified_name || '-';
                row.insertCell().textContent = mat.model_number || '-';
                row.insertCell().textContent = mat.unit || '-';
                row.insertCell().textContent = mat.source || '-';
                row.insertCell().textContent = mat.quantity_spec || '-';
                row.insertCell().textContent = mat.purpose || '-';
                row.insertCell().textContent = mat.storage_location || '-';

                // 操作列 (仅非只读模式下显示)
                const actionsCell = row.insertCell();
                if (!isReadOnly) {
                    actionsCell.innerHTML = \`
                        <button class="edit-btn" onclick="loadForm(\${JSON.stringify(mat).replace(/"/g, '&quot;')})">编辑</button>
                        <button class="delete-btn" onclick="handleDelete('\${mat.UID}')">删除</button>
                    \`;
                } else {
                    actionsCell.style.display = 'none';
                }
            });
        }
        
        
        // --- 供应商管理和价格更新功能 (新增) ---
        
        // 1. 获取供应商列表 (管理员使用)
        async function fetchSuppliers() {
            if (currentUserRole !== 'admin') return;

            try {
                const response = await fetch(\`\${API_BASE_URL}/suppliers\`\, {
                    headers: getAuthHeaders()
                });
                
                if (response.ok) {
                    allSuppliers = await response.json();
                    const select = document.getElementById('assign_supplier_uuid');
                    select.innerHTML = '<option value="">-- 请选择供应商 --</option>';
                    allSuppliers.forEach(sup => {
                        const option = document.createElement('option');
                        option.value = sup.supplier_uuid;
                        option.textContent = sup.company_name;
                        select.appendChild(option);
                    });
                }
            } catch (error) {
                console.error("Failed to fetch suppliers:", error);
            }
        }


        // 2. 创建供应商账户 (管理员使用)
        async function handleCreateSupplierAccount() {
            const status = document.getElementById('supplier-create-status');
            const username = document.getElementById('sup_username').value;
            const password = document.getElementById('sup_password').value;
            const company_name = document.getElementById('sup_company_name').value;
            
            if (!username || !password || !company_name) {
                status.textContent = '所有字段不能为空。'; status.style.color = 'red'; return;
            }
            status.textContent = '正在创建...'; status.style.color = 'blue';

            try {
                const response = await fetch(\`\${API_BASE_URL}/suppliers\`\, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ username, password, company_name })
                });
                
                const result = await response.json(); // 【已修复】后端返回 JSON

                if (response.ok && result.status === 'success') {
                    status.textContent = \`账户创建成功! 供应商: \${company_name}\`;
                    status.style.color = 'green';
                    fetchSuppliers(); // 刷新下拉列表
                } else {
                    // 【已修复】显示后端返回的 JSON message
                    status.textContent = \`账户创建失败: \${result.message || response.statusText}\`;
                    status.style.color = 'red';
                }

            } catch (error) {
                status.textContent = '网络错误, 账户创建失败: ' + error.message;
                status.style.color = 'red';
            }
        }


        // 3. 分配材料给供应商 (管理员使用)
        async function handleAssignMaterial() {
            const status = document.getElementById('assign-status');
            const UID = document.getElementById('assign_uid').value.trim();
            const supplier_uuid = document.getElementById('assign_supplier_uuid').value;
            
            if (!UID || !supplier_uuid) {
                status.textContent = '请填写材料 UID 并选择供应商。'; status.style.color = 'red'; return;
            }
            status.textContent = '正在分配材料...'; status.style.color = 'blue';

            try {
                const response = await fetch(\`\${API_BASE_URL}/materials/assign\`\, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ UID, supplier_uuid })
                });
                
                const result = await response.json();

                if (response.ok && result.status === 'success') {
                    status.textContent = result.message;
                    status.style.color = 'green';
                    fetchMaterials(); // 刷新主材料列表
                } else {
                    status.textContent = \`分配失败: \${result.message || response.statusText}\`;
                    status.style.color = 'red';
                }

            } catch (error) {
                status.textContent = '网络错误，分配失败: ' + error.message;
                status.style.color = 'red';
            }
        }
        
        
        // 4. 供应商查询自己的材料和价格 (供应商使用)
        async function fetchSupplierMaterials() {
            const body = document.getElementById('supplier-results-body');
            const companyNameDisplay = document.getElementById('supplier-company-name');
            body.innerHTML = '<tr><td colspan="7" style="text-align: center;">正在查询供应商材料...</td></tr>'; 
            
            try {
                const response = await fetch(\`\${API_BASE_URL}/supplier/materials\`\, {
                    headers: getAuthHeaders() 
                });

                if (response.ok) {
                    const data = await response.json();
                    // 【已修复】后端返回 company_name
                    companyNameDisplay.textContent = data.company_name; 
                    renderSupplierMaterials(data.materials);
                } else if (response.status === 403 || response.status === 401) {
                    body.innerHTML = '<tr><td colspan="7" style="color: red; text-align: center;">权限不足或登录过期，请重新登录。</td></tr>';
                    handleLogout();
                } else {
                    body.innerHTML = '<tr><td colspan="7" style="color: red; text-align: center;">查询失败: ' + response.statusText + '</td></tr>';
                }
            } catch (error) {
                body.innerHTML = '<tr><td colspan="7" style="color: red; text-align: center;">网络错误: ' + error.message + '</td></tr>';
            }
        }

        // 5. 渲染供应商材料列表
        function renderSupplierMaterials(materials) {
            const body = document.getElementById('supplier-results-body');
            body.innerHTML = ''; 

            if (materials.length === 0) {
                body.innerHTML = '<tr><td colspan="7" style="text-align: center;">管理员尚未分配任何材料给您。</td></tr>';
                return;
            }

            materials.forEach(mat => {
                const row = body.insertRow();
                
                // 1. 图片
                const imgCell = row.insertCell();
                if (mat.image_url) {
                    imgCell.innerHTML = \`\<a href="\${mat.image_url}" target="_blank"><img src="\${mat.image_url}" class="material-img" alt="\${mat.unified_name}"></a>\`\;
                } else {
                    imgCell.textContent = '-';
                }
                
                row.insertCell().textContent = mat.unified_name || '-';
                row.insertCell().textContent = mat.model_number || '-';
                row.insertCell().textContent = mat.unit || '-';
                
                // 价格
                row.insertCell().textContent = mat.price !== null ? \`￥\${parseFloat(mat.price).toFixed(2)}\` : '未报价';
                // 更新时间
                row.insertCell().textContent = mat.updated_at ? new Date(mat.updated_at).toLocaleString() : '-';

                // 更新价格操作
                const actionsCell = row.insertCell();
                actionsCell.innerHTML = \`
                    <input type="number" id="price_\${mat.UID}" placeholder="新价格" style="width: 60px; display: inline-block; margin-right: 5px;" step="0.01">
                    <button onclick="handleUpdatePrice('\${mat.UID}')" style="padding: 5px 8px; background-color: #ffc107; color: #333;">更新</button>
                    <p id="price_status_\${mat.UID}" style="font-size: 0.8em; margin: 2px 0; color: blue;"></p>
                \`;
            });
        }


        // 6. 更新价格 (供应商使用)
        async function handleUpdatePrice(uid) {
            const input = document.getElementById(\`price_\${uid}\`);
            const status = document.getElementById(\`price_status_\${uid}\`);
            const price = input.value;
            
            if (!price || isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
                status.textContent = '请输入有效价格。'; status.style.color = 'red'; return;
            }
            
            status.textContent = '正在更新...'; status.style.color = 'blue';

            try {
                const response = await fetch(\`\${API_BASE_URL}/prices\`\, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ material_uid: uid, price: parseFloat(price) })
                });
                
                const result = await response.json();

                if (response.ok && result.status === 'success') {
                    status.textContent = '更新成功！';
                    status.style.color = 'green';
                    // 刷新列表以显示新价格
                    fetchSupplierMaterials(); 
                } else {
                    status.textContent = \`更新失败: \${result.message || response.statusText}\`;
                    status.style.color = 'red';
                }

            } catch (error) {
                status.textContent = '网络错误，更新失败: ' + error.message;
                status.style.color = 'red';
            }
        }

        // --- 初始化 ---
        document.addEventListener('DOMContentLoaded', () => {
            // 自动加载数据（访客模式）
            fetchMaterials();
            checkAuthStatus();
        });

    </script>
</body>
</html>
`;

// --- 后端工具函数 ---

/**
 * 这是一个简化的密码比较函数，在生产环境中应该使用强大的哈希库，例如 argon2。
 * 此处仅用于演示目的，假定密码 'testpass' 存储为纯文本 'testpass'。
 * 真实的 D1 中应存储密码哈希。
 * @param {string} inputPassword - 用户输入的密码
 * @param {string} storedHashOrPass - 存储的哈希或原始密码
 * @param {object} env - Worker 环境对象
 * @returns {Promise<boolean>}
 */
async function comparePassword(inputPassword, storedHashOrPass, env) {
    // 假设在演示阶段，密码 hash 就是原始密码 'testpass'
    // 生产环境中，您需要使用 Web Crypto API 进行真正的哈希比较
    return inputPassword === storedHashOrPass;
}

/**
 * 根据 R2 Key 生成公共访问 URL
 * @param {string} key - R2 存储桶中的对象 key
 * @param {object} env - Worker 环境对象
 * @returns {string | null}
 */
function getPublicImageUrl(key, env) {
    if (!key || !env.R2_PUBLIC_DOMAIN) return null;
    // 确保 URL 规范性
    const domain = env.R2_PUBLIC_DOMAIN.endsWith('/') ? env.R2_PUBLIC_DOMAIN : env.R2_PUBLIC_DOMAIN + '/';
    return `${domain}\${key}`;
}


// --- 鉴权中间件 (修改以返回用户payload) 
async function authenticate(request, env) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { authorized: false, status: 401 }; 
    }
    const token = authHeader.split(' ')[1];
    
    try {
        // 解码以获取 payload
        const payload = await jwt.decode(token); 
        // 验证签名
        const isValid = await jwt.verify(token, env.JWT_SECRET); 
        
        if (!isValid) {
            return { authorized: false, status: 403 };
        }
        // 返回 payload，包含 role 和 supplier_uuid
        return { authorized: true, payload: payload.payload }; 
    } catch (e) {
        return { authorized: false, status: 403 };
    }
}

// --- 权限守卫函数 (新增) ---

/**
 * 检查是否为管理员
 * @param {object} payload - JWT Payload
 * @returns {Response | null} - 错误响应或 null
 */
function adminGuard(payload) {
    if (!payload || payload.role !== 'admin') {
        // 【修复】统一 JSON 错误响应格式
        return new Response(JSON.stringify({ 
            status: 'error', 
            message: 'Authentication failed: Only Admin is authorized for this action.'
        }), { 
            status: 403, 
            headers: { 'Content-Type': 'application/json' } 
        });
    }
    return null; // OK
}

/**
 * 检查是否为供应商并有 UUID
 * @param {object} payload - JWT Payload
 * @returns {Response | null} - 错误响应或 null
 */
function supplierGuard(payload) {
    if (!payload || payload.role !== 'supplier' || !payload.supplier_uuid) {
        return new Response(JSON.stringify({ 
            status: 'error', 
            message: 'Authentication failed: Only authorized Supplier is allowed.'
        }), { 
            status: 403, 
            headers: { 'Content-Type': 'application/json' } 
        });
    }
    return null; // OK
}

// --- 后端 API 路由处理函数 ---

// 1. 登录 (修改)
async function handleLogin(request, env) {
    const headers = { 'Content-Type': 'application/json' };
    if (!env.DB) return new Response(JSON.stringify({ message: 'DB binding is missing.' }), { status: 500, headers });
    if (!env.JWT_SECRET) return new Response(JSON.stringify({ message: 'JWT_SECRET is not configured.' }), { status: 500, headers });
    
    try {
        const { username, password } = await request.json();
        
        // 【修复 1】SQL 查询：增加 role 和 supplier_uuid
        const { results: users } = await env.DB.prepare(
            "SELECT id, password_hash, role, supplier_uuid FROM users WHERE username = ?"
        ).bind(username).all();

        if (users.length === 0) {
            return new Response(JSON.stringify({ message: 'Invalid credentials (User not found)' }), { status: 401, headers });
        }
        
        const user = users[0];
        
        if (!await comparePassword(password, user.password_hash, env)) { 
             return new Response(JSON.stringify({ message: 'Invalid credentials (Password mismatch)' }), { status: 401, headers });
        }

        try {
            // 【修复 2】JWT Payload：增加 role 和 supplier_uuid
            const payload = { 
                user_id: user.id, 
                role: user.role, 
                supplier_uuid: user.supplier_uuid, 
                exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24)
            };
            const token = await jwt.sign(payload, env.JWT_SECRET);

            return new Response(JSON.stringify({ 
                token, 
                user_id: user.id,
                role: user.role, 
                supplier_uuid: user.supplier_uuid 
            }), { headers });

        } catch (jwtError) {
            return new Response(JSON.stringify({ message: 'JWT Signing Error.' }), { status: 500, headers });
        }

    } catch (e) {
        console.error("Login error:", e.message);
        return new Response(JSON.stringify({ message: `Internal Server Error: ${e.message}` }), { status: 500, headers });
    }
}

// 2. 查询材料 (保持不变，但增加 supplier_uuid 字段)
async function handleQueryMaterials(request, env) {
    const headers = { 'Content-Type': 'application/json' };
    if (!env.DB) return new Response(JSON.stringify({ message: 'DB binding is missing.' }), { status: 500, headers });
    
    try {
        const url = new URL(request.url);
        const keyword = url.searchParams.get('keyword');
        
        let stmt;
        if (keyword) {
            const likeKeyword = `%${keyword}%`;
            // 增加 supplier_uuid 查询
            stmt = env.DB.prepare(`
                SELECT *, 
                (SELECT price FROM prices p WHERE p.material_uid = m.UID ORDER BY p.updated_at DESC LIMIT 1) as current_price
                FROM materials m 
                WHERE unified_name LIKE ? OR model_number LIKE ? OR purpose LIKE ? OR notes LIKE ?
                LIMIT 100
            `).bind(likeKeyword, likeKeyword, likeKeyword, likeKeyword);
        } else {
            // 增加 supplier_uuid 查询
            stmt = env.DB.prepare(`
                SELECT *, 
                (SELECT price FROM prices p WHERE p.material_uid = m.UID ORDER BY p.updated_at DESC LIMIT 1) as current_price
                FROM materials m 
                LIMIT 100
            `);
        }
        
        const { results } = await stmt.all();
        
        const materialsWithImages = results.map(mat => ({
            ...mat,
            image_url: getPublicImageUrl(mat.r2_image_key, env) // 增加公共 URL
        }));

        return new Response(JSON.stringify(materialsWithImages), { headers });
    } catch (e) {
        console.error("Query materials error:", e);
        return new Response(JSON.stringify({ message: `Internal Server Error: ${e.message}` }), { status: 500, headers });
    }
}


// 3. 创建/更新材料 (修改：增加 supplier_uuid)
async function handleCreateUpdateMaterial(request, env) {
    const headers = { 'Content-Type': 'application/json' };
    const { payload } = await authenticate(request, env);
    const adminCheck = adminGuard(payload);
    if (adminCheck) return adminCheck;
    if (!env.DB) return new Response(JSON.stringify({ message: 'DB binding is missing.' }), { status: 500, headers });

    try {
        const material = await request.json();
        
        const requiredFields = ['unified_name', 'model_number', 'unit'];
        for (const field of requiredFields) {
            if (!material[field]) {
                return new Response(JSON.stringify({ message: `Missing required field: ${field}` }), { status: 400, headers });
            }
        }

        const isNew = !material.UID;
        const UID = isNew ? `M-\${crypto.randomUUID().substring(0, 8).toUpperCase()}` : material.UID;
        const currentTimestamp = new Date().toISOString();
        
        // 注意：这里没有设置 supplier_uuid，需要管理员手动分配

        const stmt = env.DB.prepare(`
            INSERT OR REPLACE INTO materials (
                UID, unified_name, model_number, unit, source, quantity_spec, 
                purpose, storage_location, notes, r2_image_key, created_at, updated_at
            ) VALUES (
                ?, ?, ?, ?, ?, ?, 
                ?, ?, ?, ?, COALESCE((SELECT created_at FROM materials WHERE UID = ?), ?), ?
            )
        `).bind(
            UID, material.unified_name, material.model_number, material.unit, material.source || null, 
            material.quantity_spec || null, material.purpose || null, material.storage_location || null, 
            material.notes || null, material.r2_image_key || null,
            UID, currentTimestamp, currentTimestamp
        );

        await stmt.run();

        return new Response(JSON.stringify({ status: 'success', message: 'Material saved successfully.', UID }), { headers });

    } catch (e) {
        console.error("Create/Update material error:", e);
        return new Response(JSON.stringify({ message: `Internal Server Error: ${e.message}` }), { status: 500, headers });
    }
}


// 4. 删除材料 (保持不变)
async function handleDeleteMaterial(request, env) {
    const headers = { 'Content-Type': 'application/json' };
    const { payload } = await authenticate(request, env);
    const adminCheck = adminGuard(payload);
    if (adminCheck) return adminCheck;
    if (!env.DB) return new Response(JSON.stringify({ message: 'DB binding is missing.' }), { status: 500, headers });
    
    try {
        const url = new URL(request.url);
        const UID = url.pathname.split('/').pop();

        const stmt = env.DB.prepare("DELETE FROM materials WHERE UID = ?").bind(UID);
        const result = await stmt.run();

        if (result.changes === 0) {
            return new Response(JSON.stringify({ status: 'error', message: `Material UID ${UID} not found.` }), { status: 404, headers });
        }

        return new Response(JSON.stringify({ status: 'success', message: 'Material deleted successfully.' }), { headers });

    } catch (e) {
        console.error("Delete material error:", e);
        return new Response(JSON.stringify({ message: `Internal Server Error: ${e.message}` }), { status: 500, headers });
    }
}


// 5. R2 图片上传 (保持不变)
async function handleDirectUpload(request, env) {
    const headers = { 'Content-Type': 'application/json' };
    const { payload } = await authenticate(request, env);
    const adminCheck = adminGuard(payload);
    if (adminCheck) return adminCheck;
    if (!env.R2_MEDIA) return new Response(JSON.stringify({ message: 'R2 binding is missing.' }), { status: 500, headers });
    
    try {
        const formData = await request.formData();
        const file = formData.get('file');

        if (!file || !file.size) {
            return new Response(JSON.stringify({ message: 'No file provided or file is empty.' }), { status: 400, headers });
        }

        // 使用 UUID 作为 Key，确保唯一性
        const fileKey = `image-\${crypto.randomUUID()}`;

        await env.R2_MEDIA.put(fileKey, file.stream());

        return new Response(JSON.stringify({ status: 'success', key: fileKey }), { headers });

    } catch (e) {
        console.error("R2 Upload error:", e);
        return new Response(JSON.stringify({ message: `Internal Server Error: ${e.message}` }), { status: 500, headers });
    }
}


// 6. CSV 导入 (保持不变)
async function handleImportMaterials(request, env) {
    const headers = { 'Content-Type': 'application/json' };
    const { payload } = await authenticate(request, env);
    const adminCheck = adminGuard(payload);
    if (adminCheck) return adminCheck;
    if (!env.DB) return new Response(JSON.stringify({ message: 'DB binding is missing.' }), { status: 500, headers });
    
    try {
        const formData = await request.formData();
        const file = formData.get('csv_file');

        if (!file || !file.size) {
            return new Response(JSON.stringify({ message: 'No file provided or file is empty.' }), { status: 400, headers });
        }

        const csvText = await file.text();
        // 简单 CSV 解析 (假设第一行为标题，逗号分隔)
        const lines = csvText.trim().split('\n');
        const headersCsv = lines[0].split(',').map(h => h.trim());
        const dataLines = lines.slice(1);
        
        let importedCount = 0;
        let updatedCount = 0;
        const currentTimestamp = new Date().toISOString();
        
        const fieldNames = ['UID', 'unified_name', 'model_number', 'unit', 'source', 'quantity_spec', 'purpose', 'storage_location', 'notes'];
        
        const statements = dataLines.map(line => {
            const values = line.split(',');
            const material = {};
            let isUpdate = false;
            
            fieldNames.forEach((field, index) => {
                const csvIndex = headersCsv.indexOf(field);
                if (csvIndex !== -1 && values[csvIndex]) {
                    material[field] = values[csvIndex].trim();
                }
            });

            if (material.UID) {
                isUpdate = true;
            } else {
                 material.UID = `M-\${crypto.randomUUID().substring(0, 8).toUpperCase()}`;
            }

            const stmt = env.DB.prepare(`
                INSERT OR REPLACE INTO materials (
                    UID, unified_name, model_number, unit, source, quantity_spec, 
                    purpose, storage_location, notes, created_at, updated_at
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, 
                    ?, ?, ?, COALESCE((SELECT created_at FROM materials WHERE UID = ?), ?), ?
                )
            `).bind(
                material.UID, material.unified_name || null, material.model_number || null, material.unit || null, 
                material.source || null, material.quantity_spec || null, material.purpose || null, 
                material.storage_location || null, material.notes || null, 
                material.UID, currentTimestamp, currentTimestamp
            );
            
            if (isUpdate) updatedCount++; else importedCount++;
            return stmt;
        });

        await env.DB.batch(statements);

        return new Response(JSON.stringify({ 
            status: 'success', 
            message: 'CSV import successful.', 
            importedCount: importedCount, 
            updatedCount: updatedCount 
        }), { headers });

    } catch (e) {
        console.error("CSV Import error:", e);
        return new Response(JSON.stringify({ message: `CSV Import Failed: ${e.message}` }), { status: 500, headers });
    }
}


// --- 供应商管理 API (新增) ---

// 7. 创建供应商账户 (管理员功能)
async function handleCreateSupplier(request, env, payload) {
    const headers = { 'Content-Type': 'application/json' };
    const adminCheck = adminGuard(payload);
    if (adminCheck) return adminCheck;
    if (!env.DB) return new Response(JSON.stringify({ message: 'DB binding is missing.' }), { status: 500, headers });

    try {
        const { username, password, company_name } = await request.json();
        
        if (!username || !password || !company_name) {
            return new Response(JSON.stringify({ message: 'Missing required fields: username, password, company_name' }), { status: 400, headers });
        }

        // 1. 生成新的 UUID
        const supplier_uuid = crypto.randomUUID();
        const password_hash = password; // 简化处理，实际应哈希

        // 2. 插入 suppliers 表
        const supplierStmt = env.DB.prepare(`
            INSERT INTO suppliers (supplier_uuid, company_name)
            VALUES (?, ?)
        `).bind(supplier_uuid, company_name);

        // 3. 插入 users 表 (role: supplier)
        const userStmt = env.DB.prepare(`
            INSERT INTO users (username, password_hash, role, supplier_uuid)
            VALUES (?, ?, 'supplier', ?)
        `).bind(username, password_hash, supplier_uuid);
        
        await env.DB.batch([supplierStmt, userStmt]);

        return new Response(JSON.stringify({ 
            status: 'success', 
            message: `Supplier ${company_name} created.`, 
            supplier_uuid 
        }), { headers });

    } catch (e) {
        if (e.message.includes('UNIQUE constraint failed')) {
            return new Response(JSON.stringify({ 
                status: 'error', 
                message: `User ${username} already exists.`
            }), { status: 409, headers });
        }
        console.error("Create Supplier error:", e);
        return new Response(JSON.stringify({ message: `Create Supplier Failed: ${e.message}` }), { status: 500, headers });
    }
}

// 8. 查询所有供应商 (用于管理员分配)
async function handleQuerySuppliers(request, env, payload) {
    const headers = { 'Content-Type': 'application/json' };
    const adminCheck = adminGuard(payload);
    if (adminCheck) return adminCheck;
    if (!env.DB) return new Response(JSON.stringify({ message: 'DB binding is missing.' }), { status: 500, headers });
    
    try {
        const { results } = await env.DB.prepare("SELECT supplier_uuid, company_name FROM suppliers").all();
        return new Response(JSON.stringify(results), { headers });
    } catch (e) {
        console.error("Query Suppliers error:", e);
        return new Response(JSON.stringify({ message: `Query Suppliers Failed: ${e.message}` }), { status: 500, headers });
    }
}


// 9. 管理员分配材料给供应商
async function handleAssignSupplierToMaterial(request, env, payload) {
    const headers = { 'Content-Type': 'application/json' };
    const adminCheck = adminGuard(payload);
    if (adminCheck) return adminCheck;
    if (!env.DB) return new Response(JSON.stringify({ message: 'DB binding is missing.' }), { status: 500, headers });
    
    try {
        const { UID, supplier_uuid } = await request.json();

        if (!UID || !supplier_uuid) {
            return new Response(JSON.stringify({ message: 'Missing required fields: UID and supplier_uuid.' }), { status: 400, headers });
        }
        
        // 检查供应商是否存在
        const { results: suppliers } = await env.DB.prepare(
            "SELECT company_name FROM suppliers WHERE supplier_uuid = ?"
        ).bind(supplier_uuid).all();

        if (suppliers.length === 0) {
            return new Response(JSON.stringify({ message: `Supplier UUID ${supplier_uuid} not found.` }), { status: 404, headers });
        }

        // 更新 materials 表
        const stmt = env.DB.prepare(`
            UPDATE materials SET supplier_uuid = ? WHERE UID = ?
        `).bind(supplier_uuid, UID);

        const result = await stmt.run();

        if (result.changes === 0) {
            return new Response(JSON.stringify({ status: 'error', message: `Material UID ${UID} not found or no change.` }), { status: 404, headers });
        }

        return new Response(JSON.stringify({ 
            status: 'success', 
            message: `Material ${UID} assigned to ${suppliers[0].company_name}.` 
        }), { headers });

    } catch (e) {
        console.error("Assign Material error:", e);
        return new Response(JSON.stringify({ message: `Material Assignment Failed: ${e.message}` }), { status: 500, headers });
    }
}


// 10. 供应商查询自己负责的材料
async function handleSupplierQueryMaterials(request, env, payload) {
    const headers = { 'Content-Type': 'application/json' };
    const supplierCheck = supplierGuard(payload);
    if (supplierCheck) return supplierCheck;
    if (!env.DB) return new Response(JSON.stringify({ message: 'DB binding is missing.' }), { status: 500, headers });
    
    const supplier_uuid = payload.supplier_uuid;

    try {
        // 1. 查询供应商名称 (用于前端显示)
        const { results: supplierInfo } = await env.DB.prepare(
            "SELECT company_name FROM suppliers WHERE supplier_uuid = ?"
        ).bind(supplier_uuid).all();
        
        // 2. 查询供应商被分配的材料及其价格
        const { results: materialsWithPrices } = await env.DB.prepare(`
            SELECT 
                m.UID, m.unified_name, m.model_number, m.unit, m.r2_image_key,
                p.price, p.updated_at, m.supplier_uuid
            FROM materials m
            LEFT JOIN prices p ON m.UID = p.material_uid AND m.supplier_uuid = p.supplier_uuid
            WHERE m.supplier_uuid = ?
            LIMIT 100
        `).bind(supplier_uuid).all();
        
        // 【修复 3】返回 company_name
        return new Response(JSON.stringify({
            status: 'success',
            company_name: supplierInfo.length > 0 ? supplierInfo[0].company_name : '未知供应商',
            materials: materialsWithPrices.map(mat => ({
                ...mat,
                image_url: getPublicImageUrl(mat.r2_image_key, env) 
            }))
        }), { headers });

    } catch (e) {
        console.error("Supplier Query error:", e);
        return new Response(JSON.stringify({ message: `Supplier Query Failed: ${e.message}` }), { status: 500, headers });
    }
}


// 11. 供应商更新价格
async function handleUpdatePrice(request, env, payload) {
    const headers = { 'Content-Type': 'application/json' };
    const supplierCheck = supplierGuard(payload);
    if (supplierCheck) return supplierCheck;
    if (!env.DB) return new Response(JSON.stringify({ message: 'DB binding is missing.' }), { status: 500, headers });
    
    const supplier_uuid = payload.supplier_uuid;

    try {
        const { material_uid, price } = await request.json();
        
        if (!material_uid || typeof price === 'undefined' || isNaN(parseFloat(price))) {
            return new Response(JSON.stringify({ message: 'Missing required fields: material_uid and valid price.' }), { status: 400, headers });
        }
        
        const priceFloat = parseFloat(price);
        const currentTimestamp = new Date().toISOString();

        // 检查该材料是否真的分配给了该供应商
        const { results: check } = await env.DB.prepare(
            "SELECT UID FROM materials WHERE UID = ? AND supplier_uuid = ?"
        ).bind(material_uid, supplier_uuid).all();

        if (check.length === 0) {
            return new Response(JSON.stringify({ message: `Material ${material_uid} is not assigned to this supplier.` }), { status: 403, headers });
        }

        // INSERT OR REPLACE 更新价格
        const stmt = env.DB.prepare(`
            INSERT OR REPLACE INTO prices (material_uid, supplier_uuid, price, updated_at)
            VALUES (?, ?, ?, ?)
        `).bind(material_uid, supplier_uuid, priceFloat, currentTimestamp);

        await stmt.run();

        return new Response(JSON.stringify({ 
            status: 'success', 
            message: `Price for ${material_uid} updated to ${priceFloat}.`,
            updated_at: currentTimestamp
        }), { headers });

    } catch (e) {
        console.error("Update Price error:", e);
        return new Response(JSON.stringify({ message: `Update Price Failed: ${e.message}` }), { status: 500, headers });
    }
}


// --- Main Fetch Handler ---

function isReadOnlyRequest(method, path) {
    return method === 'GET' && path === '/api/materials';
}

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method;
        const headers = { 'Content-Type': 'text/html' };

        // 首页路由
        if (path === '/') {
            return new Response(FRONTEND_HTML, { headers });
        }

        if (path === '/api/login' && method === 'POST') {
            return handleLogin(request, env);
        }
        
        // 所有 API 路由
        if (path.startsWith('/api/')) {
            
            // 1. 只读查询 (访客模式可访问)
            if (isReadOnlyRequest(method, path)) {
                return handleQueryMaterials(request, env);
            }

            // 2. 需要授权的操作
            const authResult = await authenticate(request, env);
            if (!authResult.authorized) {
                // 对于非 GET 请求，返回 401
                if (method !== 'GET') {
                    return new Response(JSON.stringify({ message: 'Authentication Required for this action' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
                }
                // 对于需要 Auth 的 GET 请求，返回 404/401
                return new Response('Not Found or Unauthorized', { status: 404, headers });
            }
            
            // --- 材料 CRUD (Admin Only) ---
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

            // --- 新增的供应商/价格路由 (Admin/Supplier) ---
            
            // 管理员: 创建供应商账户
            if (path === '/api/suppliers' && method === 'POST') {
                return handleCreateSupplier(request, env, authResult.payload);
            }

            // 管理员: 查询所有供应商
            if (path === '/api/suppliers' && method === 'GET') {
                return handleQuerySuppliers(request, env, authResult.payload);
            }
            
            // 管理员: 分配材料给供应商
            if (path === '/api/materials/assign' && method === 'POST') {
                 return handleAssignSupplierToMaterial(request, env, authResult.payload);
            }
            
            // 供应商: 查询自己负责的材料及价格
            if (path === '/api/supplier/materials' && method === 'GET') {
                return handleSupplierQueryMaterials(request, env, authResult.payload);
            }
            
            // 供应商: 更新价格
            if (path === '/api/prices' && method === 'POST') {
                return handleUpdatePrice(request, env, authResult.payload);
            }
        }

        return new Response('Not Found', { status: 404 });
    }
};
