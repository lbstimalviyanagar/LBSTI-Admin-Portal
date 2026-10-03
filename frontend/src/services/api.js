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

  async deleteFee(id) {
    return request(`/fees/${id}`, {
      method: "DELETE"
    });
  },

  // Receipts
  async issueReceipt(paymentId) {
    return request("/receipts", {
      method: "POST",
      body: { paymentId }
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
  }
};

export default api;
