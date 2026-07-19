import { useAppStore, loadUserFromStorage, clearUserFromStorage } from "../store/appStore";

describe("会话持久化（注册信息回填基石）", () => {
  beforeEach(() => {
    clearUserFromStorage();
    localStorage.clear();
  });

  it("setUser 写入后 loadUserFromStorage 可还原姓名与科室", () => {
    useAppStore.getState().setUser("张三", "普通用户", {
      badge: "123456",
      phone: "13800000000",
      department: "法制室",
    });
    const saved = loadUserFromStorage();
    expect(saved?.name).toBe("张三");
    expect(saved?.department).toBe("法制室");
    expect(saved?.badge).toBe("123456");
    expect(saved?.phone).toBe("13800000000");
  });

  it("store 内 userName / userDepartment 同步被填充", () => {
    useAppStore.getState().setUser("李四", "部门主管", { department: "涉众办" });
    expect(useAppStore.getState().userName).toBe("李四");
    expect(useAppStore.getState().userDepartment).toBe("涉众办");
  });

  it("空用户名调用 setUser 时清空本地会话存储", () => {
    useAppStore.getState().setUser("张三", "普通用户", { department: "法制室" });
    expect(loadUserFromStorage()).not.toBeNull();
    useAppStore.getState().setUser("", "");
    expect(loadUserFromStorage()).toBeNull();
  });
});
