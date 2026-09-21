# Validation — fe-tools-packer-lifecycle-audit

## V-PLA-1 — 文档存在

```bash
test -f docs/actions/fe-tools-packer-lifecycle-audit/source-audit.md && echo "OK" || echo "MISSING"
```
预期：OK

## V-PLA-2 — 关键发现 F-1..F-6 存在

```bash
grep -c '### F-' docs/actions/fe-tools-packer-lifecycle-audit/source-audit.md
```
预期：≥ 6（F-1 through F-6）

## V-PLA-3 — F-1..F-6 回流 core-shape

```bash
grep -c 'F-[1-6]' docs/actions/fe-tools-packer-core-shape/draft.md
grep -c 'F-[1-6]' docs/actions/fe-tools-packer-core-shape/technical-design.md
```
预期：draft.md ≥ 6；technical-design.md ≥ 1

## V-PLA-4 — 行为 0（research only）

```bash
git diff --stat -- fe/tools/bundler/
```
预期：空（不改产品代码）

## V-PLA-5 — validator

```bash
python3 /Users/foolishchow/.pi/agent/skills/manage-actions/scripts/validate_action.py --repo . --all
```
预期：0 errors, 0 warnings
