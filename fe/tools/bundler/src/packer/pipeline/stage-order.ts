/**
 * 编译 stage 顺序常量（D-HR-5 下沉：原 pipeline/compile-target.ts → model）。
 *
 * ③a 消解：model→pipeline upward leak（invalidation.ts 从 pipeline import）。
 * 下沉到 model 后，pipeline 消费点（compile-target / compile-stages）改为
 * 向下 import model（layering 正确）。
 *
 * 语义不变：['view', 'logic', 'style']——view 先（组件树发现）→ logic → style。
 */
export const COMPILE_STAGE_ORDER: string[] = ['view', 'logic', 'style']
