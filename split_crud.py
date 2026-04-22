import re
import os

with open('backend/crud.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

imports = []
sections = {}
current_section = None

# Extract top level imports
for line in lines:
    if line.startswith('from ') or line.startswith('import '):
        imports.append(line)
    elif line.startswith('# Users'):
        current_section = 'users'
        sections[current_section] = []
    elif line.startswith('# User Groups'):
        current_section = 'groups'
        sections[current_section] = []
    elif line.startswith('# Branches'):
        current_section = 'branches'
        sections[current_section] = []
    elif line.startswith('# Cost Centers'):
        current_section = 'cost_centers'
        sections[current_section] = []
    elif line.startswith('# Sectors'):
        current_section = 'sectors'
        sections[current_section] = []
    elif line.startswith('# Categories'):
        current_section = 'categories'
        sections[current_section] = []
    elif line.startswith('# Suppliers'):
        current_section = 'suppliers'
        sections[current_section] = []
    elif line.startswith('# Items'):
        current_section = 'items'
        sections[current_section] = []
    elif line.startswith('# System Settings'):
         current_section = 'system'
         sections[current_section] = []
    elif line.startswith('# Approval Workflows'):
         current_section = 'workflows'
         sections[current_section] = []
    elif line.startswith('# Requests'):
         current_section = 'requests'
         sections[current_section] = []
    else:
         if current_section and not (line.startswith('from ') and 'sqlalchemy' in line and current_section is None):
             sections[current_section].append(line)

os.makedirs('backend/crud', exist_ok=True)

# Define mappings based on what we see
# groups should go to users.py
if 'groups' in sections:
    sections['users'].extend(["\n# User Groups\n"])
    sections['users'].extend(sections['groups'])

# Also requests has some extra lines, and system has logs but items has some parts interleaved
# Wait, look at the original file:
# 425: # Items
# 692: # System Settings (get_system, get_all_logs, request_write_off, update_item, request_transfer)
# Wait, request_write_off and update_item are under # System Settings in the file?
# Let's check lines 720-833. Yes, request_write_off, update_item, request_transfer are mixed.
# That's why splitting by script based on naive headers might put `request_transfer` in `system.py`.

# Actually, I'll just write the entire content of crud.py to `crud_split_temp.py` and then I'll manually split or do it safely.
