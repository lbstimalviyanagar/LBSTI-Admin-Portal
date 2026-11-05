const TOKEN_KEY = "lbstimn_token";

// Read API Base from Vite environment or default to relative /api for proxy/single-origin deployments
const getApiBase = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && envUrl.trim()) {
    const base = envUrl.trim().replace(/\/+$/, '');
    return base.endsWith('/api') ? base : `${base}/api`;
  }
  if (import.meta.env.PROD) throw new Error('VITE_API_URL must be set to the deployed HTTPS API URL before the production build.');
  return "/api";
};

export const normalizeDocumentUrl = (value) => {
  const input = String(value || "").trim();
  if (!input) return "";

  try {
    const apiOrigin = new URL(getApiBase(), window.location.origin).origin;
    const url = input.startsWith("/")
      ? new URL(input, apiOrigin)
      : new URL(/^[a-z][a-z\d+.-]*:/i.test(input) ? input : `https://${input}`);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
};

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch (e) {
    return "";
  }
};

export const setToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch (e) {}
};

export const hasToken = () => !!getToken();

async function request(path, options = {}) {
  const base = getApiBase();
  const url = `${base}/${path.replace(/^\/+/, "")}`;
  const headers = {
    Accept: "application/json",
    ...options.headers
  };

  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (options.body && typeof options.body === "object" && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(options.body);
  }

  let res;
  try {
    res = await fetch(url, {
      ...options,
      headers
    });
  } catch (err) {
    const customErr = new Error(`Unable to connect to the server at ${url}. Please verify that the backend is running and allows this origin.`);
    customErr.code = 0;
    throw customErr;
  }

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (e) {
      if (res.ok) throw new Error(`Invalid JSON response from server (HTTP ${res.status}).`);
    }
  }

  if (!res.ok) {
    const message = (data && (data.message || data.error)) || (text && !text.startsWith("<") ? text.trim() : `Request failed (HTTP ${res.status})`);
    const err = new Error(message);
    err.code = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

function normalizeCourseContent(record) {
  if (!record || typeof record !== "object") return record;
  return {
    ...record,
    title: record.title ?? record.module_title ?? record.moduleTitle ?? "",
    topic: record.topic ?? record.topic_title ?? record.topicTitle ?? "",
    content: record.content ?? record.description ?? "",
    module_no: record.module_no ?? record.moduleNo ?? record.content_order ?? record.contentOrder ?? 1,
    order_index: record.order_index ?? record.content_order ?? record.contentOrder ?? 1
  };
}

function courseContentPayload(data) {
  return {
    ...data,
    course_id: data.course_id ?? data.courseId,
    module_title: data.module_title ?? data.moduleTitle ?? data.title,
    topic_title: data.topic_title ?? data.topicTitle ?? data.topic,
    content_order: data.content_order ?? data.contentOrder ?? data.order_index ?? data.module_no,
    description: data.description ?? data.content
  };
}

function normalizeCourseSyllabus(record) {
  if (!record || typeof record !== "object") return record;
  return {
    ...record,
    document_url: record.document_url || record.file_url || record.fileUrl || "",
    description: record.description || record.summary || "",
    file_name: record.file_name ?? record.fileName ?? "",
    file_size: record.file_size ?? record.fileSize ?? 0,
    file_type: record.file_type ?? record.fileType ?? ""
  };
}

function courseSyllabusPayload(data) {
  return {
    ...data,
    course_id: data.course_id ?? data.courseId,
    summary: data.description ?? data.summary,
    file_url: data.document_url ?? data.fileUrl ?? data.file_url
  };
}

function normalizeCourseNote(record) {
  if (!record || typeof record !== "object") return record;
  return {
    ...record,
    content: record.content || record.notes_content || record.notesContent || "",
    attachment_url: record.attachment_url || record.file_url || record.fileUrl || "",
    file_name: record.file_name ?? record.fileName ?? "",
    file_size: record.file_size ?? record.fileSize ?? 0,
    file_type: record.file_type ?? record.fileType ?? ""
  };
}

function courseNotePayload(data) {
  return {
    ...data,
    course_id: data.course_id ?? data.courseId,
    notes_content: data.content ?? data.notesContent ?? data.notes_content,
    file_url: data.attachment_url ?? data.fileUrl ?? data.file_url
  };
}

export const api = {
  // Authentication
  async login(username, password) {
    const res = await request("/auth/login", {
      method: "POST",
      body: { username, password }
    });
    if (res && res.token) {
      setToken(res.token);
    }
    return res;
  },

  logout() {
    setToken("");
    try {
      localStorage.removeItem("lbstimn_user");
    } catch (e) {}
  },

  async getMe() {
    return request("/auth/me", { method: "GET" });
  },

  // Health check
  async health() {
    return request("/health", { method: "GET" });
  },

  // Enquiries
  async getEnquiries() {
    const data = await request("/enquiries", { method: "GET" });
    return Array.isArray(data) ? data : data?.data || [];
  },

  async createEnquiry(enquiryData) {
    return request("/enquiries", {
      method: "POST",
      body: enquiryData
    });
  },

  async bulkCreateEnquiries(leads) {
    return request("/enquiries/bulk", {
      method: "POST",
      body: { leads }
    });
  },

  async updateEnquiry(id, patch) {
    return request(`/enquiries/${id}`, {
      method: "PATCH",
      body: patch
    });
  },

  async deleteEnquiry(id) {
    return request(`/enquiries/${id}`, {
      method: "DELETE"
    });
  },

  async confirmEnquiry(id) {
    return request(`/enquiries/${id}/confirm`, {
      method: "POST"
    });
  },

  // Remarks
  async getRemarks(enquiryId) {
    const data = await request(`/enquiries/${enquiryId}/remarks`, { method: "GET" });
    return Array.isArray(data) ? data : data?.data || [];
  },

  async addRemark(enquiryId, text, author) {
    return request(`/enquiries/${enquiryId}/remarks`, {
      method: "POST",
      body: { text, author, remark: text }
    });
  },

  // Fees
  async getFees() {
    const data = await request("/fees", { method: "GET" });
    return Array.isArray(data) ? data : data?.data || [];
  },

  async createFee(feeData) {
    return request("/fees", {
      method: "POST",
      body: feeData
    });
  },

  async updateFee(id, patch) {
    return request(`/fees/${id}`, {
      method: "PATCH",
      body: patch
    });
  },

  async deleteFee(id) {
    return request(`/fees/${id}`, {
      method: "DELETE"
    });
  },

  // Expenses
  async getExpenses() {
    const data = await request("/expenses", { method: "GET" });
    return Array.isArray(data) ? data : [];
  },
  async getExpenseCategories() {
    const data = await request("/expenses/categories", { method: "GET" });
    return Array.isArray(data) ? data : [];
  },
  async createExpense(data) {
    return request("/expenses", { method: "POST", body: data });
  },
  async updateExpense(id, patch) {
    return request(`/expenses/${id}`, { method: "PUT", body: patch });
  },
  async deleteExpense(id) {
    return request(`/expenses/${id}`, { method: "DELETE" });
  },
  async createExpenseCategory(data) {
    return request("/expenses/categories", { method: "POST", body: data });
  },
  async updateExpenseCategory(id, patch) {
    return request(`/expenses/categories/${id}`, { method: "PATCH", body: patch });
  },
  async deleteExpenseCategory(id) {
    return request(`/expenses/categories/${id}`, { method: "DELETE" });
  },
  async getExpenseReceipt(id, fallbackName = "receipt") {
    const response = await fetch(`${getApiBase()}/expenses/${encodeURIComponent(id)}/receipt`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    if (!response.ok) {
      let message = `Unable to open the receipt (HTTP ${response.status}).`;
      try {
        const data = await response.json();
        if (data?.message) message = data.message;
      } catch (error) {
        // Keep the HTTP status message when the server does not return JSON.
      }
      const requestError = new Error(message);
      requestError.code = response.status;
      throw requestError;
    }
    const disposition = response.headers.get("Content-Disposition") || "";
    const encodedFilename = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
    const quotedFilename = disposition.match(/filename="([^"]+)"/i)?.[1];
    const filename = (encodedFilename && decodeURIComponent(encodedFilename)) || quotedFilename || fallbackName;
    return { blob: await response.blob(), filename };
  },

  // Receipts
  async issueReceipt(paymentId) {
    return request("/receipts", {
      method: "POST",
      body: { paymentId }
    });
  },

  
  // Students
  async getStudents() {
    return request("/students", { method: "GET" });
  },
  async searchStudents(q) {
    if (!q || q.trim().length < 1) return [];
    const data = await request(`/search-students?q=${encodeURIComponent(q.trim())}`, { method: "GET" });
    return Array.isArray(data) ? data : [];
  },
  async createStudent(data) {
    return request("/students", {
      method: "POST",
      body: JSON.stringify(data)
    });
  },
  async updateStudent(id, data) {
    return request(`/students/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data)
    });
  },
  async deleteStudent(id) {
    return request(`/students/${id}`, { method: "DELETE" });
  },
  async bulkImportStudents(students) {
    return request("/students/bulk", {
      method: "POST",
      body: { students }
    });
  },

  // Enrollments
  async getEnrollments() {
    return request("/enrollments", { method: "GET" });
  },
  async createEnrollment(data) {
    return request("/enrollments", {
      method: "POST",
      body: JSON.stringify(data)
    });
  },
  async updateEnrollment(id, data) {
    return request(`/enrollments/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data)
    });
  },
  async deleteEnrollment(id) {
    return request(`/enrollments/${id}`, { method: "DELETE" });
  },
  async bulkImportEnrollments(enrollments) {
    return request("/enrollments/bulk", {
      method: "POST",
      body: { enrollments }
    });
  },

  // Users
  async getUsers() {
    const data = await request("/users", { method: "GET" });
    return Array.isArray(data) ? data : data?.data || [];
  },

  async createUser(userData) {
    return request("/users", {
      method: "POST",
      body: userData
    });
  },

  async updateUser(id, patch) {
    return request(`/users/${id}`, {
      method: "PATCH",
      body: patch
    });
  },

  async deleteUser(id) {
    return request(`/users/${id}`, {
      method: "DELETE"
    });
  },

  // Attendance
  async getAttendance(filters = {}) {
    const params = new URLSearchParams();
    if (filters.staff_id && filters.staff_id !== "All") params.append("staff_id", filters.staff_id);
    if (filters.date && filters.date !== "All") params.append("date", filters.date);
    if (filters.status && filters.status !== "All") params.append("status", filters.status);
    if (filters.q) params.append("q", filters.q);
    const qs = params.toString();
    const query = qs ? `?${qs}` : "";
    return request(`/attendance${query}`, { method: "GET" });
  },
  async getAttendanceFilterOptions() {
    try {
      return await request("/attendance/options", { method: "GET" });
    } catch (e) {
      return { staff: [], statuses: ['Present', 'Half Day', 'Leave', 'Absent'], dates: [] };
    }
  },
  async clockIn() {
    return request("/attendance/clock-in", { method: "POST" });
  },
  async clockOut() {
    return request("/attendance/clock-out", { method: "PUT" });
  },

  // Tasks
  async getTasks(filters = {}) {
    const params = new URLSearchParams();
    if (filters.assignedTo && filters.assignedTo !== "All") params.append("assigned_to", filters.assignedTo);
    if (filters.status && filters.status !== "All") params.append("status", filters.status);
    if (filters.q) params.append("q", filters.q);
    const qs = params.toString();
    const query = qs ? `?${qs}` : "";
    return request(`/tasks${query}`, { method: "GET" });
  },
  async getTaskFilterOptions() {
    try {
      return await request("/tasks/options", { method: "GET" });
    } catch (e) {
      return { faculty: [] };
    }
  },
  async createTask(data) {
    return request("/tasks", {
      method: "POST",
      body: data
    });
  },
  async submitTask(id, data = {}) {
    return request(`/tasks/${id}/submit`, {
      method: "POST",
      body: data
    });
  },
  async checkTaskDeadlines() {
    return request("/tasks/check-deadlines", { method: "POST" });
  },
  async getTaskNotifications(taskId = null) {
    const q = taskId ? `?task_id=${taskId}` : "";
    return request(`/tasks/notifications${q}`, { method: "GET" });
  },
  async updateTask(id, patch) {
    return request(`/tasks/${id}`, {
      method: "PATCH",
      body: patch
    });
  },
  async deleteTask(id) {
    return request(`/tasks/${id}`, { method: "DELETE" });
  },

  // Batches
  async getBatches(dateStr = "", filters = {}) {
    const params = new URLSearchParams();
    if (dateStr) params.append("date", dateStr);
    if (filters.course && filters.course !== "All") params.append("course", filters.course);
    if (filters.faculty && filters.faculty !== "All") params.append("instructor_id", filters.faculty);
    if (filters.status && filters.status !== "All") params.append("status", filters.status);
    if (filters.q) params.append("q", filters.q);
    const qs = params.toString();
    const query = qs ? `?${qs}` : "";
    return request(`/batches${query}`, { method: "GET" });
  },
  async getBatchFilterOptions() {
    try {
      return await request("/batches/options", { method: "GET" });
    } catch (e) {
      return { courses: [], faculty: [] };
    }
  },
  async createBatch(data) {
    return request("/batches", {
      method: "POST",
      body: data
    });
  },
  async updateBatch(id, patch) {
    return request(`/batches/${id}`, {
      method: "PATCH",
      body: patch
    });
  },
  async deleteBatch(id) {
    return request(`/batches/${id}`, { method: "DELETE" });
  },

  // Check Phone Duplicate (Phase 2.2)
  async checkPhone(phone) {
    if (!phone) return null;
    try {
      return await request(`/enquiries/check-phone?phone=${encodeURIComponent(phone.trim())}`, { method: "GET" });
    } catch (e) {
      return null;
    }
  },

  // Course Management (Phase 2.3 & Phase 4)
  async getCourses() {
    try {
      const data = await request("/courses", { method: "GET" });
      return Array.isArray(data) ? data : data?.data || [];
    } catch (e) {
      return [];
    }
  },
  async createCourse(data) {
    return request("/courses", { method: "POST", body: data });
  },
  async updateCourse(id, patch) {
    return request(`/courses/${id}`, { method: "PATCH", body: patch });
  },
  async deleteCourse(id) {
    return request(`/courses/${id}`, { method: "DELETE" });
  },

  // Course Content Modules (Phase 4)
  async getCourseContent(courseId = null) {
    const q = courseId ? `?course_id=${courseId}` : "";
    const data = await request(`/course-content${q}`, { method: "GET" });
    return Array.isArray(data) ? data.map(normalizeCourseContent) : [];
  },
  async createCourseContent(data) {
    const record = await request("/course-content", { method: "POST", body: courseContentPayload(data) });
    return normalizeCourseContent(record);
  },
  async updateCourseContent(id, patch) {
    const record = await request(`/course-content/${id}`, { method: "PATCH", body: courseContentPayload(patch) });
    return normalizeCourseContent(record);
  },
  async deleteCourseContent(id) {
    return request(`/course-content/${id}`, { method: "DELETE" });
  },

  // Syllabus (Phase 4)
  async getCourseSyllabus(courseId = null) {
    const q = courseId ? `?course_id=${courseId}` : "";
    const data = await request(`/course-syllabus${q}`, { method: "GET" });
    return Array.isArray(data) ? data.map(normalizeCourseSyllabus) : [];
  },
  async createCourseSyllabus(data) {
    const record = await request("/course-syllabus", { method: "POST", body: courseSyllabusPayload(data) });
    return normalizeCourseSyllabus(record);
  },
  async updateCourseSyllabus(id, patch) {
    const record = await request(`/course-syllabus/${id}`, { method: "PATCH", body: courseSyllabusPayload(patch) });
    return normalizeCourseSyllabus(record);
  },
  async deleteCourseSyllabus(id) {
    return request(`/course-syllabus/${id}`, { method: "DELETE" });
  },

  // Notes (Phase 4)
  async getCourseNotes(courseId = null) {
    const q = courseId ? `?course_id=${courseId}` : "";
    const data = await request(`/course-notes${q}`, { method: "GET" });
    return Array.isArray(data) ? data.map(normalizeCourseNote) : [];
  },
  async createCourseNotes(data) {
    const record = await request("/course-notes", { method: "POST", body: courseNotePayload(data) });
    return normalizeCourseNote(record);
  },
  async updateCourseNotes(id, patch) {
    const record = await request(`/course-notes/${id}`, { method: "PATCH", body: courseNotePayload(patch) });
    return normalizeCourseNote(record);
  },
  async deleteCourseNotes(id) {
    return request(`/course-notes/${id}`, { method: "DELETE" });
  },

  // Student Attendance (Phase 5)
  async getStudentAttendance(filters = {}) {
    const params = new URLSearchParams();
    if (filters.date) params.append("date", filters.date);
    if (filters.course && filters.course !== "All") params.append("course", filters.course);
    if (filters.batch_time && filters.batch_time !== "All") params.append("batch_time", filters.batch_time);
    if (filters.student_id) params.append("student_id", filters.student_id);
    if (filters.status && filters.status !== "All") params.append("status", filters.status);
    if (filters.q) params.append("q", filters.q);
    const qs = params.toString();
    return request(`/student-attendance${qs ? '?' + qs : ''}`, { method: "GET" });
  },
  async recordStudentAttendance(data) {
    return request("/student-attendance", { method: "POST", body: data });
  },
  async updateStudentAttendance(id, patch) {
    return request(`/student-attendance/${id}`, { method: "PATCH", body: patch });
  },
  async getStudentAttendanceHistory(studentId) {
    return request(`/student-attendance/history?student_id=${encodeURIComponent(studentId)}`, { method: "GET" });
  },
  async getStudentAttendanceSummary(filters = {}) {
    const params = new URLSearchParams();
    if (filters.month) params.append("month", filters.month);
    if (filters.course && filters.course !== "All") params.append("course", filters.course);
    const qs = params.toString();
    return request(`/student-attendance/summary${qs ? '?' + qs : ''}`, { method: "GET" });
  },

  // Social Media Content Planner (Bonus Feature)
  async getSocialPosts(filters = {}) {
    const params = new URLSearchParams();
    if (filters.platform && filters.platform !== "All") params.append("platform", filters.platform);
    if (filters.status && filters.status !== "All") params.append("status", filters.status);
    if (filters.month) params.append("month", filters.month);
    if (filters.q) params.append("q", filters.q);
    const qs = params.toString();
    return request(`/social-planner${qs ? '?' + qs : ''}`, { method: "GET" });
  },
  async createSocialPost(data) {
    return request("/social-planner", { method: "POST", body: data });
  },
  async updateSocialPost(id, patch) {
    return request(`/social-planner/${id}`, { method: "PATCH", body: patch });
  },
  async deleteSocialPost(id) {
    return request(`/social-planner/${id}`, { method: "DELETE" });
  }
};

export default api;
