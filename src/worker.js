// src/worker.js
import * as jwt from '@tsndr/cloudflare-worker-jwt';

const FRONTEND_HTML = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>小学教育材料统一数据库</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 20px; background-color: #f4f7f6; color: #333; }
        h1 { color: #007bff; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
        
        /* 导航与布局 */
        .nav-tabs { margin-bottom: 20px; border-bottom: 1px solid #ddd; }
        .nav-btn {
            padding: 10px 20px; cursor: pointer; background: #e9ecef; border: none;
            border-radius: 5px 5px 0 0; margin-right: 5px; font-weight: bold; font-size: 1rem;
        }
        .nav-btn.active { background: #007bff; color: white; }
        .tab-content { display: none; }
        .tab-content.active { display: block; }

        .section-card { 
            margin-bottom: 30px; padding: 20px; background-color: #fff;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1); border-radius: 8px;
        }

        /* 表单元素 */
        input:not([type="file"]), select, textarea { 
            padding: 8px; margin: 5px 0; width: 100%; box-sizing: border-box;
            border: 1px solid #ccc; border-radius: 4px;
        }
        .form-group { margin-bottom: 10px; }
        .form-row { display: flex; gap: 20px; }
        .form-row > div { flex: 1; }
        
        /* 按钮 */
        button {
            padding: 10px 15px; margin: 5px; background-color: #28a745; color: white;
            border: none; border-radius: 4px; cursor: pointer; transition: 0.3s;
        }
        button:hover { opacity: 0.9; }
        button.delete-btn { background-color: #dc3545; }
        button.edit-btn { background-color: #ffc107; color: #333; }
        
        /* 表格 */
        table { width: 100%; border-collapse: collapse; margin-top: 20px; table-layout: fixed; }
        th, td { border: 1px solid #e0e0e0; padding: 8px; text-align: left; word-wrap: break-word; font-size: 0.9em; }
        th { background-color: #e9ecef; font-weight: bold; }
        
        .material-img { max-width: 50px; max-height: 50px; object-fit: cover; border-radius: 4px; cursor: pointer; }
        .readonly-mode { background-color: #ffffe0; padding: 10px; margin-bottom: 20px; border-left: 5px solid #ffc107; font-weight: bold; }
        
        /* 登录框特殊样式 */
        #auth-section { max-width: 400px; margin: 50px auto; text-align: center; }
        .role-select { margin-bottom: 15px; padding: 10px; font-size: 1.1em; }
    </style>
</head>
<body>
    <h1 id="page-title">📚 小学教育材料统一数据库</h1>

    <div id="auth-section" class="section-card">
        <h2>🔑 系统登录</h2>
        
        <div class="form-group">
            <label style="font-weight:bold; display:block; text-align:left;">请选择身份:</label>
            <select id="login-role" class="role-select">
                <option value="admin">管理员 (Admin)</option>
                <option value="supplier">供应商 (Supplier)</option>
            </select>
        </div>

        <input type="text" id="username" value="test" placeholder="用户名 / 账号">
        <input type="password" id="password" value="testpass" placeholder="密码">
        
        <button onclick="handleLogin()" style="width:100%; margin-top:10px;">登录</button>
        <button onclick="handleViewAsGuest()" style="width:100%; background-color: #6c757d; margin-top:5px;">我是访客 (只读浏览)</button>
        
        <p id="login-status" style="color: red; margin-top: 10px;"></p>
    </div>
    
    <div id="main-section" style="display:none;">
        <div id="user-info-bar" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; background:#e9ecef; padding:10px; border-radius:5px;">
            <span id="welcome-msg" style="font-weight:bold;"></span>
            <button onclick="handleLogout()" id="logout-btn" style="background-color: #dc3545; margin:0;">退出登录</button>
        </div>

        <div id="read-only-notice" class="readonly-mode" style="display:none;">
            当前为只读模式。
        </div>
        
        <div class="nav-tabs">
            <button class="nav-btn active" onclick="switchTab('materials')" id="btn-tab-materials">📦 材料库</button>
            <button class="nav-btn" onclick="switchTab('suppliers')" id="btn-tab-suppliers">🏭 供应商管理</button>
        </div>

        <div id="tab-materials" class="tab-content active section-card">
            
            <div id="manual-section">
                <h3>📝 材料录入 / 编辑 <button onclick="resetManualForm()" style="background-color: #17a2b8; font-size:0.8em;">清空</button></h3>
                <form id="material-form">
                    <div class="form-row">
                        <div class="form-group">
                            <label>统一名称 *</label>
                            <input type="text" id="f_unified_name" name="unified_name" required>
                        </div>
                        <div class="form-group">
                            <label>唯一识别码 (UID) *</label>
                            <input type="text" id="f_UID" name="UID" required>
                        </div>
                        <div class="form-group" id="supplier-select-group">
                            <label>关联供应商</label>
                            <select id="f_supplier_id" name="supplier_id">
                                <option value="">(无/未分配)</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group"><label>参考价格(元)</label><input type="number" step="0.01" id="f_price" name="price"></div>
                        <div class="form-group"><label>单位</label><input type="text" id="f_unit" name="unit"></div>
                        <div class="form-group"><label>材质</label><input type="text" id="f_material_type" name="material_type"></div>
                        <div class="form-group"><label>型号</label><input type="text" id="f_model_number" name="model_number"></div>
                    </div>

                    <div class="form-row">
                        <div class="form-group"><label>长 (mm)</label><input type="number" step="0.01" id="f_length_mm" name="length_mm"></div>
                        <div class="form-group"><label>宽/高 (mm)</label><input type="number" step="0.01" id="f_width_mm" name="width_mm"></div>
                        <div class="form-group"><label>直径 (mm)</label><input type="number" step="0.01" id="f_diameter_mm" name="diameter_mm"></div>
                        <div class="form-group"><label>颜色</label><input type="text" id="f_color" name="color"></div>
                    </div>

                    <div class="form-row">
                        <div class="form-group" style="flex: 2;">
                            <label>外观描述</label>
                            <input type="text" id="f_appearance" name="appearance" placeholder="外观特征...">
                        </div>
                        <div class="form-group" style="flex: 2;">
                            <label>备注</label>
                            <textarea id="f_notes" name="notes" rows="1"></textarea>
                        </div>
                        <div class="form-group">
                            <label>别名</label>
                            <input type="text" id="f_alias" name="alias">
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group" style="flex: 3;">
                            <label>R2 图片路径</label>
                            <div class="upload-controls">
                                <input type="text" id="f_r2_image_key" name="r2_image_key" placeholder="folder/img.jpg">
                                <input type="file" id="f_image_file" accept="image/*">
                                <button type="button" onclick="handleImageUpload()" id="upload-btn">上传</button>
                            </div>
                        </div>
                    </div>
                    
                    <button type="submit" id="save-btn" onclick="event.preventDefault(); handleSave()">💾 保存记录</button>
                    <p id="manual-status" style="color: blue;"></p>
                </form>
            </div>

            <div id="import-section">
                <h3>📤 批量导入</h3>
                <input type="file" id="import-file" accept=".json, .csv">
                <button onclick="handleBulkImport()" id="import-btn">导入数据</button>
                <span id="import-status" style="color: blue;"></span>
            </div>

            <div id="query-section">
                <h3>🔍 列表查询</h3>
                <div style="display:flex; gap:10px;">
                    <input type="text" id="search-query" placeholder="输入关键字查询..." style="flex:1;">
                    <button onclick="fetchMaterials()" style="width:100px;">查询</button>
                </div>
                
                <table id="results-table">
                    <thead>
                        <tr>
                            <th width="50">图片</th>
                            <th>统一名称</th>
                            <th>供应商</th> 
                            <th>价格</th>
                            <th>外观</th>
                            <th>规格/型号</th>
                            <th>UID</th>
                            <th>备注</th> 
                            <th id="actions-header" width="100">操作</th>
                        </tr>
                    </thead>
                    <tbody id="results-body"></tbody>
                </table>
            </div>
        </div>

        <div id="tab-suppliers" class="tab-content section-card">
            <h3>🏭 供应商账号管理</h3>
            <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px; border:1px solid #ddd;">
                <h4>➕ 添加 / 编辑 供应商</h4>
                <input type="hidden" id="s_id">
                
                <div class="form-row">
                    <div class="form-group">
                        <label>供应商名称 *</label>
                        <input type="text" id="s_name" placeholder="企业名称">
                    </div>
                    <div class="form-group">
                        <label>联系方式 / 支付账号</label>
                        <input type="text" id="s_account" placeholder="电话、支付宝等">
                    </div>
                </div>
                
                <div class="form-row" style="background: #e3f2fd; padding: 10px; border-radius: 4px;">
                    <div class="form-group">
                        <label><strong>登录用户名</strong> (用于供应商登录系统)</label>
                        <input type="text" id="s_username" placeholder="设置登录账号 (例如: deli01)">
                    </div>
                    <div class="form-group">
                        <label><strong>登录密码</strong></label>
                        <input type="text" id="s_password" placeholder="设置登录密码">
                    </div>
                </div>

                <div class="form-group">
                    <label>备注</label>
                    <textarea id="s_notes" rows="1"></textarea>
                </div>
                
                <button onclick="handleSaveSupplier()">保存供应商信息</button>
                <button onclick="resetSupplierForm()" style="background-color: #17a2b8;">重置</button>
                <p id="supplier-status" style="color: blue;"></p>
            </div>

            <table id="suppliers-table">
                <thead>
                    <tr>
                        <th width="5%">ID</th>
                        <th>名称</th>
                        <th>登录账号</th> <th>密码(明文)</th> <th>联系信息</th>
                        <th width="15%">操作</th>
                    </tr>
                </thead>
                <tbody id="suppliers-body"></tbody>
            </table>
        </div>
    </div>

    <script>
        const API_BASE_URL = '/api'; 
        // 包含所有字段
        const FIELD_NAMES = [
            "unified_name", "material_type", "sub_category", "model_number", 
            "unit", "length_mm", "width_mm", "diameter_mm", "color", 
            "UID", "notes", "alias", "r2_image_key",
            "price", "appearance", "supplier_id"
        ];
        
        let currentUserRole = 'guest'; // 'admin' | 'supplier' | 'guest'
        let currentSupplierId = null;  // 如果是供应商登录，记录ID
        let allSuppliers = []; 

        window.onload = function() {
            const token = localStorage.getItem('jwtToken');
            const savedRole = localStorage.getItem('userRole');
            const isGuest = localStorage.getItem('isGuest');

            if (token && savedRole) {
                currentUserRole = savedRole;
                showMainUI();
            } else if (isGuest === 'true') {
                currentUserRole = 'guest';
                showMainUI();
            }
        };
        
        function showMainUI() {
            document.getElementById('auth-section').style.display = 'none';
            document.getElementById('main-section').style.display = 'block';
            
            // UI 权限控制
            const welcomeSpan = document.getElementById('welcome-msg');
            const supplierTabBtn = document.getElementById('btn-tab-suppliers');
            const importSection = document.getElementById('import-section');
            const supplierSelectGroup = document.getElementById('supplier-select-group');
            const readOnlyNotice = document.getElementById('read-only-notice');

            if (currentUserRole === 'admin') {
                welcomeSpan.textContent = '👤 管理员模式';
                welcomeSpan.style.color = 'green';
                supplierTabBtn.style.display = 'inline-block';
                importSection.style.display = 'block';
                readOnlyNotice.style.display = 'none';
                supplierSelectGroup.style.display = 'block'; // 管理员可以选供应商
                initData(); 
            } 
            else if (currentUserRole === 'supplier') {
                welcomeSpan.textContent = '🏭 供应商模式 (仅查看自家产品)';
                welcomeSpan.style.color = '#007bff';
                supplierTabBtn.style.display = 'none'; // 隐藏供应商管理Tab
                importSection.style.display = 'none';  // 禁止供应商批量导入
                readOnlyNotice.style.display = 'none';
                supplierSelectGroup.style.display = 'none'; // 供应商不能选别人，只能是自己
                // 供应商登录只需要加载材料，不需要加载完整供应商列表(隐私)
                fetchMaterials(); 
            } 
            else {
                welcomeSpan.textContent = '👀 访客模式 (只读)';
                readOnlyNotice.style.display = 'block';
                supplierTabBtn.style.display = 'none';
                importSection.style.display = 'none';
                document.getElementById('manual-section').style.display = 'none'; // 访客不能录入
                document.getElementById('actions-header').style.display = 'none';
                initData();
            }
        }
        
        function initData() {
            fetchSuppliers().then(() => fetchMaterials());
        }
        
        function switchTab(tab) {
            document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
            document.getElementById('tab-' + tab).classList.add('active');
            document.getElementById('btn-tab-' + tab).classList.add('active');
        }

        function getAuthHeaders() {
            return {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('jwtToken')
            };
        }

        // --- 登录逻辑 (Updated) ---
        async function handleLogin() {
            const role = document.getElementById('login-role').value;
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const status = document.getElementById('login-status');
            
            status.textContent = '正在验证...';
            
            try {
                const res = await fetch(API_BASE_URL + '/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password, role }) // 发送角色
                });

                if (res.ok) {
                    const data = await res.json();
                    localStorage.setItem('jwtToken', data.token);
                    localStorage.setItem('userRole', role);
                    localStorage.removeItem('isGuest');
                    currentUserRole = role;
                    
                    status.textContent = '登录成功';
                    location.reload(); // 刷新以重置状态
                } else {
                    status.textContent = '登录失败: ' + (await res.text());
                }
            } catch (e) { status.textContent = 'Error: ' + e.message; }
        }
        
        function handleViewAsGuest() {
            localStorage.setItem('isGuest', 'true');
            location.reload();
        }
        function handleLogout() {
            localStorage.clear();
            location.reload();
        }

        // --- 供应商管理 (Admin Only) ---
        async function fetchSuppliers() {
            if (currentUserRole !== 'admin') return; 
            try {
                const res = await fetch(API_BASE_URL + '/suppliers', { headers: getAuthHeaders() });
                if (res.ok) {
                    allSuppliers = await res.json();
                    renderSupplierTable();
                    updateSupplierDropdown();
                }
            } catch(e) {}
        }

        function renderSupplierTable() {
            const tbody = document.getElementById('suppliers-body');
            tbody.innerHTML = '';
            allSuppliers.forEach(s => {
                const row = tbody.insertRow();
                row.innerHTML = \`
                    <td>\${s.id}</td>
                    <td><strong>\${s.name}</strong></td>
                    <td style="color:blue">\${s.username || '-'}</td>
                    <td style="color:#aaa">\${s.password || '-'}</td>
                    <td>\${s.account_info || '-'}</td>
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

        async function handleSaveSupplier() {
            const id = document.getElementById('s_id').value;
            const data = {
                id: id ? parseInt(id) : null,
                name: document.getElementById('s_name').value,
                account_info: document.getElementById('s_account').value,
                notes: document.getElementById('s_notes').value,
                username: document.getElementById('s_username').value, // New
                password: document.getElementById('s_password').value  // New
            };
            
            if(!data.name) return alert('名称必填');
            
            const res = await fetch(API_BASE_URL + '/suppliers', {
                method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(data)
            });
            if (res.ok) {
                resetSupplierForm(); fetchSuppliers(); alert('保存成功');
            } else { alert('保存失败'); }
        }
        
        function editSupplier(id) {
            const s = allSuppliers.find(x => x.id == id);
            if(!s) return;
            document.getElementById('s_id').value = s.id;
            document.getElementById('s_name').value = s.name;
            document.getElementById('s_account').value = s.account_info || '';
            document.getElementById('s_notes').value = s.notes || '';
            document.getElementById('s_username').value = s.username || '';
            document.getElementById('s_password').value = s.password || '';
        }
        
        function resetSupplierForm() {
            document.getElementById('s_id').value = '';
            document.getElementById('s_name').value = '';
            document.getElementById('s_username').value = '';
            document.getElementById('s_password').value = '';
            document.getElementById('s_account').value = '';
            document.getElementById('s_notes').value = '';
        }
        
        async function deleteSupplier(id) {
            if(confirm('删除此供应商账号？')) {
                await fetch(\`\${API_BASE_URL}/suppliers/\${id}\`, { method: 'DELETE', headers: getAuthHeaders() });
                fetchSuppliers();
            }
        }

        // --- 材料管理 ---
        async function fetchMaterials() {
            const query = document.getElementById('search-query').value;
            const body = document.getElementById('results-body');
            body.innerHTML = '<tr><td colspan="9" style="text-align:center">加载中...</td></tr>';
            
            try {
                const res = await fetch(\`\${API_BASE_URL}/materials?q=\${encodeURIComponent(query)}\`, {
                    headers: getAuthHeaders()
                });
                if(res.ok) {
                    const data = await res.json();
                    renderMaterials(data);
                } else {
                    body.innerHTML = '<tr><td colspan="9" style="text-align:center;color:red">加载失败</td></tr>';
                }
            } catch(e) {}
        }

        function renderMaterials(materials) {
            const body = document.getElementById('results-body');
            body.innerHTML = '';
            if (materials.length === 0) {
                body.innerHTML = '<tr><td colspan="9" style="text-align:center">暂无数据</td></tr>';
                return;
            }
            
            materials.forEach(mat => {
                const row = body.insertRow();
                let dim = [];
                if(mat.model_number) dim.push(mat.model_number);
                if(mat.length_mm && mat.width_mm) dim.push(\`\${mat.length_mm}x\${mat.width_mm}\`);
                
                const cleanMat = JSON.stringify(mat).replace(/'/g, "\\\\'");
                
                const imgHtml = mat.image_url ? \`<a href="\${mat.image_url}" target="_blank"><img src="\${mat.image_url}" class="material-img"></a>\` : '-';
                
                row.innerHTML = \`
                    <td>\${imgHtml}</td>
                    <td>\${mat.unified_name}</td>
                    <td>\${mat.supplier_name || '-'}</td>
                    <td>\${mat.price ? '¥'+mat.price : '-'}</td>
                    <td>\${mat.appearance || '-'}</td>
                    <td>\${dim.join(' ') || '-'}</td>
                    <td><small>\${mat.UID}</small></td>
                    <td><small>\${mat.notes || '-'}</small></td>
                    <td class="actions-cell"></td>
                \`;
                
                // 操作按钮逻辑
                const actionTd = row.querySelector('.actions-cell');
                if (currentUserRole === 'admin' || currentUserRole === 'supplier') {
                    // 管理员拥有全部权限，供应商只能编辑（不能删除）
                    let btns = \`<button class="edit-btn" onclick='handleEdit(\${cleanMat})'>编辑</button>\`;
                    if (currentUserRole === 'admin') {
                        btns += \`<button class="delete-btn" onclick="handleDelete('\${mat.UID}')">删除</button>\`;
                    }
                    actionTd.innerHTML = btns;
                } else {
                    actionTd.textContent = '-';
                }
            });
        }

        function handleEdit(mat) {
            switchTab('materials');
            FIELD_NAMES.forEach(k => {
                const el = document.getElementById('f_'+k);
                if(el) el.value = (mat[k] !== null && mat[k] !== undefined) ? mat[k] : '';
            });
            // 如果是供应商，供应商ID框应该是锁定的或隐藏的，这里简单处理
            if (currentUserRole === 'supplier') {
                // 供应商不能把材料划给别人
                // 这里的逻辑是：如果材料本身没有supplier_id，允许他认领吗？
                // 简单起见：供应商登录时，supplier_id 在后端会自动覆盖，前端显示不重要
            }
            document.getElementById('f_UID').disabled = true; // 禁止改UID
            window.scrollTo({top:0, behavior:'smooth'});
        }
        
        function getFormData() {
            const data = {};
            FIELD_NAMES.forEach(k => {
                const el = document.getElementById('f_'+k);
                if(!el) return;
                if(k.endsWith('_mm') || k==='price') data[k] = el.value ? parseFloat(el.value) : null;
                else if(k==='supplier_id') data[k] = el.value ? parseInt(el.value) : null;
                else data[k] = el.value || null;
            });
            return data;
        }
        
        async function handleSave() {
            if(currentUserRole === 'guest') return alert('只读模式');
            const data = getFormData();
            
            // 核心：如果前端提交的 supplier_id 是空的，而后端检测到是 supplier 登录，后端会自动补全
            
            const res = await fetch(API_BASE_URL+'/materials', {
                method:'POST', headers: getAuthHeaders(), body: JSON.stringify(data)
            });
            const json = await res.json();
            if(res.ok) {
                document.getElementById('manual-status').textContent = '保存成功';
                fetchMaterials();
            } else {
                alert('保存失败: ' + json.message);
            }
        }

        // 其他通用函数 (R2上传, 删除, 导入) 复用之前逻辑
        async function handleImageUpload() {
             const fileInput = document.getElementById('f_image_file');
             const keyInput = document.getElementById('f_r2_image_key');
             if (!fileInput.files[0]) return;
             const formData = new FormData();
             const r2Key = keyInput.value || \`uploads/\${Date.now()}/\${fileInput.files[0].name}\`;
             formData.append('file', fileInput.files[0]);
             formData.append('key', r2Key);
             try {
                 await fetch(API_BASE_URL+'/upload', { method:'POST', headers:{'Authorization':'Bearer '+localStorage.getItem('jwtToken')}, body:formData });
                 keyInput.value = r2Key; alert('图片上传成功');
             } catch(e) { alert('Upload failed'); }
        }
        
        async function handleDelete(uid) {
            if(!confirm('确定删除？')) return;
            await fetch(\`\${API_BASE_URL}/materials/\${uid}\`, { method:'DELETE', headers: getAuthHeaders() });
            fetchMaterials();
        }
        
        async function handleBulkImport() {
             const fileInput = document.getElementById('import-file');
             if(!fileInput.files[0]) return;
             const reader = new FileReader();
             reader.onload = async (e) => {
                 let data = JSON.parse(e.target.result); // 简化：假设是JSON
                 await fetch(API_BASE_URL+'/import', { method:'POST', headers: getAuthHeaders(), body: JSON.stringify(data) });
                 alert('导入完成'); fetchMaterials();
             };
             reader.readAsText(fileInput.files[0]);
        }

    </script>
</body>
</html>
`;

// --- 后端逻辑 ---

async function comparePassword(input, stored) { return input === stored; }
function getPublicImageUrl(key, env) { return key && env.R2_PUBLIC_DOMAIN ? `${env.R2_PUBLIC_DOMAIN}/${key}` : null; }

// Auth Token 验证
async function authenticate(req, env) {
    const auth = req.headers.get('Authorization');
    if (!auth || !auth.startsWith('Bearer ')) return { authorized: false };
    try {
        const isValid = await jwt.verify(auth.split(' ')[1], env.JWT_SECRET);
        if (!isValid) return { authorized: false };
        const { payload } = jwt.decode(auth.split(' ')[1]);
        return { authorized: true, role: payload.role, supplier_id: payload.supplier_id };
    } catch (e) { return { authorized: false }; }
}

// 登录处理 (核心更新)
async function handleLogin(req, env) {
    if (!env.DB) return new Response('DB missing', { status: 500 });
    const { username, password, role } = await req.json();
    
    let user = null;
    let tokenPayload = {};

    if (role === 'admin') {
        // 1. 管理员登录
        if (username === 'test' && password === 'testpass') {
            // Hardcoded fallback
            user = { id: 1, role: 'admin' };
        } else {
            const { results } = await env.DB.prepare("SELECT id, password_hash FROM users WHERE username = ?").bind(username).all();
            if (results.length > 0 && await comparePassword(password, results[0].password_hash || 'testpass')) {
                user = { id: results[0].id, role: 'admin' };
            }
        }
    } else if (role === 'supplier') {
        // 2. 供应商登录
        const { results } = await env.DB.prepare("SELECT id, password FROM suppliers WHERE username = ?").bind(username).all();
        if (results.length > 0 && results[0].password === password) {
            // 注意：这里为了演示用了明文比对，生产环境建议Hash
            user = { id: results[0].id, role: 'supplier' };
        }
    }

    if (!user) return new Response('Login Failed', { status: 401 });

    // 生成 Token，包含 role 和 supplier_id
    tokenPayload = { 
        user_id: user.id, 
        role: user.role, 
        supplier_id: user.role === 'supplier' ? user.id : null,
        exp: Math.floor(Date.now()/1000) + 86400 
    };
    
    const token = await jwt.sign(tokenPayload, env.JWT_SECRET);
    return new Response(JSON.stringify({ token, role: user.role }), { headers: {'Content-Type': 'application/json'} });
}

// 供应商管理 API (更新：处理 username/password)
async function handleSuppliers(req, env) {
    const method = req.method;
    if (method === 'GET') {
        const { results } = await env.DB.prepare("SELECT * FROM suppliers ORDER BY id DESC").all();
        return new Response(JSON.stringify(results), { headers: {'Content-Type': 'application/json'} });
    }
    if (method === 'POST') {
        const d = await req.json();
        if (d.id) {
            await env.DB.prepare("UPDATE suppliers SET name=?, account_info=?, notes=?, username=?, password=? WHERE id=?")
                .bind(d.name, d.account_info, d.notes, d.username, d.password, d.id).run();
        } else {
            await env.DB.prepare("INSERT INTO suppliers (name, account_info, notes, username, password) VALUES (?, ?, ?, ?, ?)")
                .bind(d.name, d.account_info, d.notes, d.username, d.password).run();
        }
        return new Response(JSON.stringify({status:'success'}), {headers:{'Content-Type':'application/json'}});
    }
}

// 材料查询 API (更新：供应商只能看自己的)
async function handleQueryMaterials(req, env, auth) {
    const url = new URL(req.url);
    const q = url.searchParams.get('q') || '';
    
    let sql = `SELECT m.*, s.name as supplier_name FROM materials m LEFT JOIN suppliers s ON m.supplier_id = s.id`;
    let params = [];
    let constraints = [];

    // 强制约束：如果是供应商，只能看自己的
    if (auth.role === 'supplier') {
        constraints.push(`m.supplier_id = ?`);
        params.push(auth.supplier_id);
    }

    if (q) {
        constraints.push(`(m.unified_name LIKE ? OR m.UID LIKE ?)`);
        params.push(`%${q}%`);
        params.push(`%${q}%`);
    }
    
    if (constraints.length > 0) {
        sql += ` WHERE ` + constraints.join(' AND ');
    }
    
    sql += ` LIMIT 100`;
    
    const { results } = await env.DB.prepare(sql).bind(...params).all();
    const data = results.map(m => ({ ...m, image_url: getPublicImageUrl(m.r2_image_key, env) }));
    return new Response(JSON.stringify(data), { headers: {'Content-Type': 'application/json'} });
}

// 材料保存 API (更新：供应商自动绑定ID)
async function handleSaveMaterial(req, env, auth) {
    const mat = await req.json();
    
    // 关键安全逻辑：如果是供应商登录，强制覆盖 supplier_id 为他自己的 ID
    if (auth.role === 'supplier') {
        mat.supplier_id = auth.supplier_id;
    }
    // 如果是管理员，则使用前端传来的 mat.supplier_id (管理员可以分配给任何人)

    const stmt = env.DB.prepare(`
        INSERT OR REPLACE INTO materials 
        (UID, unified_name, material_type, sub_category, model_number, length_mm, width_mm, diameter_mm, color, notes, alias, r2_image_key, unit, price, appearance, supplier_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
        mat.UID, mat.unified_name, mat.material_type, mat.sub_category, mat.model_number, 
        mat.length_mm, mat.width_mm, mat.diameter_mm, mat.color, mat.notes, mat.alias, mat.r2_image_key, mat.unit,
        mat.price, mat.appearance, 
        mat.supplier_id // 这里已经处理过权限了
    );
    await stmt.run();
    return new Response(JSON.stringify({ status: 'success', uid: mat.UID }), { headers: {'Content-Type': 'application/json'} });
}

// 删除 API (保持不变，但需在路由层限制供应商不能调用)
async function handleDeleteMaterial(req, env) {
    const uid = new URL(req.url).pathname.split('/').pop();
    await env.DB.prepare("DELETE FROM materials WHERE UID=?").bind(uid).run();
    return new Response(JSON.stringify({status:'success'}), { headers: {'Content-Type': 'application/json'} });
}
// 删除供应商
async function handleDeleteSupplier(req, env) {
    const id = new URL(req.url).pathname.split('/').pop();
    await env.DB.prepare("DELETE FROM suppliers WHERE id=?").bind(id).run();
    return new Response(JSON.stringify({status:'success'}), { headers: {'Content-Type': 'application/json'} });
}

// R2, Import 等保持简写，逻辑通用
async function handleDirectUpload(req, env) {
    const fd = await req.formData();
    await env.R2_MEDIA.put(fd.get('key'), fd.get('file'));
    return new Response(JSON.stringify({status:'success'}), {headers:{'Access-Control-Allow-Origin':'*'}});
}
async function handleImportMaterials(req, env) {
    const mats = await req.json();
    // 这里简化处理，如果是供应商导入(已在前端禁用)，后端最好也校验，暂时略
    const stmts = mats.map(m => env.DB.prepare(`INSERT OR REPLACE INTO materials (UID, unified_name, supplier_id, price, appearance) VALUES (?, ?, ?, ?, ?)`).bind(m.UID, m.unified_name, m.supplier_id, m.price, m.appearance)); 
    if(stmts.length) await env.DB.batch(stmts);
    return new Response(JSON.stringify({status:'success'}), {headers:{'Content-Type':'application/json'}});
}

export default {
    async fetch(req, env) {
        const url = new URL(req.url);
        const path = url.pathname;
        
        if (path === '/') return new Response(FRONTEND_HTML, { headers: { 'Content-Type': 'text/html' } });
        if (path === '/api/login') return handleLogin(req, env); // 开放登录接口
        
        if (path.startsWith('/api/')) {
            // 鉴权
            const auth = await authenticate(req, env);
            if (!auth.authorized) return new Response('Unauthorized', { status: 401 });
            
            // 路由分发
            if (path === '/api/materials') {
                if (req.method === 'GET') return handleQueryMaterials(req, env, auth);
                if (req.method === 'POST') return handleSaveMaterial(req, env, auth);
            }
            
            if (path.startsWith('/api/materials/') && req.method === 'DELETE') {
                // 只有管理员能删除
                if (auth.role !== 'admin') return new Response('Forbidden', { status: 403 });
                return handleDeleteMaterial(req, env);
            }

            // 供应商管理接口：只有管理员能访问
            if (path.startsWith('/api/suppliers')) {
                if (auth.role !== 'admin') return new Response('Forbidden: Admin Only', { status: 403 });
                if (req.method === 'DELETE') return handleDeleteSupplier(req, env);
                return handleSuppliers(req, env);
            }

            if (path === '/api/upload') return handleDirectUpload(req, env);
            if (path === '/api/import') {
                if (auth.role !== 'admin') return new Response('Forbidden', { status: 403 });
                return handleImportMaterials(req, env);
            }
        }
        return new Response('Not Found', { status: 404 });
    }
};
