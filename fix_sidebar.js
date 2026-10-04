
const fs = require("fs");
let content = fs.readFileSync("frontend/src/components/Sidebar.jsx", "utf8");

content = content.replace("tab !== 'fees' && tab !== 'users'", "['dashboard', 'new', 'table'].includes(tab)");
content = content.replace("tab === 'fees' || tab === 'users' ? 'dashboard' : tab", "['dashboard', 'new', 'table'].includes(tab) ? tab : 'dashboard'");

content = content.replace("tab === 'fees' ? 'page' : undefined", "tab === 'payments' ? 'page' : undefined");
content = content.replace("<span className=\"label\">Fees</span>", "<span className=\"label\">Payments</span>");
content = content.replace("data-tooltip-right={collapsed ? \"Fees\" : undefined}", "data-tooltip-right={collapsed ? \"Payments\" : undefined}");

const studentsTab = `
        {isFeesVisible && (
          <button
            className="nav-item"
            type="button"
            aria-current={tab === "students" ? "page" : undefined}
            onClick={() => { setTab("students"); if (onNavClick) onNavClick(); }}
            data-tooltip-right={collapsed ? "Students" : undefined}
          >
            <span className="ic"><Icon name="users" size={20} /></span>
            <span className="label">Students</span>
          </button>
        )}
`;

content = content.replace("{isAdmin && (", studentsTab + "\n        {isAdmin && (");

fs.writeFileSync("frontend/src/components/Sidebar.jsx", content);

