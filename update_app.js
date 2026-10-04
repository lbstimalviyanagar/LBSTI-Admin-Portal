
const fs = require("fs");
let content = fs.readFileSync("frontend/src/App.jsx", "utf8");

content = content.replace("import FeesPage from './pages/FeesPage';", "import PaymentsPage from './pages/PaymentsPage';\nimport StudentsPage from './pages/StudentsPage';");
content = content.replace("const [fees, setFees] = useState([]);", "const [fees, setFees] = useState([]);\n  const [students, setStudents] = useState([]);\n  const [enrollments, setEnrollments] = useState([]);");
content = content.replace("const [tab, setTab] = useState('dashboard'); // 'dashboard' | 'new' | 'table' | 'fees'", "const [tab, setTab] = useState('dashboard'); // 'dashboard' | 'new' | 'table' | 'payments' | 'students'");

// Fetching
const fetchBlock = `const [enquiryList, feeList, studentList, enrollmentList] = await Promise.all([
        api.getEnquiries(),
        api.getFees().catch(() => []),
        api.getStudents().catch(() => []),
        api.getEnrollments().catch(() => [])
      ]);
      setEnquiries(enquiryList || []);
      setFees(feeList || []);
      setStudents(studentList || []);
      setEnrollments(enrollmentList || []);`;

content = content.replace(/const \[enquiryList.*setFees\(feeList \|\| \[\]\);/s, fetchBlock);

// Logout clear
content = content.replace("setFees([]);", "setFees([]);\n    setStudents([]);\n    setEnrollments([]);");

// Rendering PaymentsPage and StudentsPage
const oldFeesRender = `{tab === 'fees' && (
            <FeesPage
              fees={fees}
              enquiries={enquiries}
              loading={loading}
              onSavePayment={handleSavePayment}
              onDeletePayment={handleDeletePayment}
              onToast={addToast}
            />
          )}`;

const newRenders = `{tab === 'payments' && (
            <PaymentsPage
              fees={fees}
              enquiries={enquiries}
              students={students}
              loading={loading}
              onSavePayment={handleSavePayment}
              onDeletePayment={handleDeletePayment}
              onToast={addToast}
            />
          )}

          {tab === 'students' && (
            <StudentsPage
              students={students}
              enrollments={enrollments}
              loading={loading}
              onRefresh={loadData}
            />
          )}`;

content = content.replace(oldFeesRender, newRenders);

fs.writeFileSync("frontend/src/App.jsx", content);

