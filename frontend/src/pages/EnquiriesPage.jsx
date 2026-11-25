import React, { useState } from 'react';
import EnquiryDashboard from '../components/EnquiryDashboard';
import EnquiriesTable from '../components/EnquiriesTable';

export default function EnquiriesPage({
  enquiries,
  loading,
  dashRangeKind,
  dashFrom,
  dashTo,
  counselorList,
  filterParams,
  setFilterParams,
  onOpenEdit,
  onConfirmAdmission,
  onRefresh,
  onGoToNewLead,
  onDrillIntoTable
}) {
  const [showAllEnquiries, setShowAllEnquiries] = useState(false);

  const handleDrillIntoTable = (patch) => {
    onDrillIntoTable(patch);
    setShowAllEnquiries(true);
  };

  if (showAllEnquiries) {
    return (
      <>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
          <button className="btn" type="button" onClick={() => setShowAllEnquiries(false)}>
            Back to analytics
          </button>
        </div>
        <EnquiriesTable
          enquiries={enquiries}
          loading={loading}
          counselorList={counselorList}
          filterParams={filterParams}
          setFilterParams={setFilterParams}
          onOpenEdit={onOpenEdit}
          onConfirmAdmission={onConfirmAdmission}
          onRefresh={onRefresh}
          onGoToNewLead={onGoToNewLead}
        />
      </>
    );
  }

  return (
    <>
      <EnquiryDashboard
        enquiries={enquiries}
        loading={loading}
        dashRangeKind={dashRangeKind}
        dashFrom={dashFrom}
        dashTo={dashTo}
        showTrendRangeFilters
        showRecentLeads={false}
        onOpenEdit={onOpenEdit}
        onConfirmAdmission={onConfirmAdmission}
        onDrillIntoTable={handleDrillIntoTable}
        onGoToNewLead={onGoToNewLead}
      />
    </>
  );
}
