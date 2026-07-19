// 测试环境所需的 IndexedDB 垫片（jsdom 不提供 indexedDB 全局对象）。
// M-15 验证阶段补充：使 massStore/draftStore 等依赖 IndexedDB 的测试可在本环境运行。
import 'fake-indexeddb/auto';
