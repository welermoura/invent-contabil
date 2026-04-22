const fs = require('fs');
const path = require('path');

const content = fs.readFileSync('backend/crud.py', 'utf-8');
const lines = content.split('\n');

const imports = [];
const blocks = {};
let currentBlock = null;
let buffer = [];

for (const line of lines) {
    if (line.startsWith('from ') || line.startsWith('import ')) {
        if (!currentBlock) {
            imports.push(line);
        } else {
            buffer.push(line);
        }
    } else if (line.startsWith('async def ')) {
        if (currentBlock) {
            blocks[currentBlock] = buffer.join('\n');
        }
        currentBlock = line.split(' ')[2].split('(')[0];
        buffer = [line];
    } else if (line.startsWith('def ')) {
        if (currentBlock) {
            blocks[currentBlock] = buffer.join('\n');
        }
        currentBlock = line.split(' ')[1].split('(')[0];
        buffer = [line];
    } else if (line.startsWith('STATUS_TRANSLATION')) {
        if (currentBlock) {
            blocks[currentBlock] = buffer.join('\n');
        }
        currentBlock = 'STATUS_TRANSLATION';
        buffer = [line];
    } else {
        if (currentBlock !== null) {
            buffer.push(line);
        }
    }
}

if (currentBlock) {
    blocks[currentBlock] = buffer.join('\n');
}

const mapping = {
    'users.py': ['get_user_by_email', 'get_user', 'create_user', 'get_users', 'get_users_by_role', 'update_user', 'delete_user', 'get_user_groups', 'create_user_group', 'update_user_group', 'delete_user_group'],
    'branches.py': ['get_branches', 'create_branch', 'update_branch', 'delete_branch', 'get_branch'],
    'cost_centers.py': ['get_cost_centers', 'get_cost_center_by_code', 'create_cost_center', 'update_cost_center', 'delete_cost_center'],
    'sectors.py': ['get_sectors', 'create_sector', 'update_sector', 'delete_sector'],
    'categories.py': ['get_categories', 'get_category_by_name', 'create_category', 'update_category', 'delete_category'],
    'suppliers.py': ['get_suppliers', 'get_supplier_by_cnpj', 'create_supplier', 'update_supplier', 'delete_supplier'],
    'items.py': ['get_items_by_ids', 'get_pending_action_items', 'get_items', 'get_item', 'STATUS_TRANSLATION', 'create_item', 'get_item_by_fixed_asset', 'update_item_status', 'request_write_off', 'update_item', 'request_transfer'],
    'system.py': ['get_system_settings', 'get_system_setting', 'update_system_setting', 'get_all_logs'],
    'workflows.py': ['get_approval_workflows', 'create_approval_workflow', 'update_approval_workflow', 'delete_approval_workflow', 'reorder_approval_workflows'],
    'requests.py': ['create_request', 'get_request', 'get_requests', 'update_request']
};

fs.mkdirSync('backend/crud', { recursive: true });

const importHeader = imports.join('\n') + '\n';

for (const [filename, funcs] of Object.entries(mapping)) {
    let fileContent = importHeader;
    for (const func of funcs) {
        if (blocks[func]) {
            fileContent += blocks[func] + '\n';
        } else {
            console.warn(`Warning: function ${func} not found in blocks`);
        }
    }
    fs.writeFileSync(`backend/crud/${filename}`, fileContent);
}

let initContent = '';
for (const filename of Object.keys(mapping)) {
    initContent += `from .${filename.replace('.py', '')} import *\n`;
}
fs.writeFileSync('backend/crud/__init__.py', initContent);
console.log('Split completed successfully');
