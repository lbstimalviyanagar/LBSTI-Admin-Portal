
const fs = require("fs");
let content = fs.readFileSync("frontend/src/components/PaymentsSection.jsx", "utf8");

content = content.replace("FeesSection", "PaymentsSection");
content = content.replace("matchedEnquiries = enquiries", "matchedEnquiries = students");
content = content.replace("selectedEnquiry = enquiries.find", "selectedEnquiry = students.find");
content = content.replace("const enquiry = enquiries.find", "const enquiry = students.find");
content = content.replace("enquiry = enquiries.find", "enquiry = students.find");
content = content.replace("enquiry.course", "enquiry?.course");
content = content.replace("enquiry.batch", "enquiry?.batch");
content = content.replace("enquiry.name", "enquiry?.name");
content = content.replace("enquiry.phone", "enquiry?.phone");

// Just globally change `enquiries.find` to `students.find`
content = content.replace(/enquiries\.find/g, "students.find");
content = content.replace(/matchedEnquiries = enquiries/g, "matchedEnquiries = students");

fs.writeFileSync("frontend/src/components/PaymentsSection.jsx", content);

