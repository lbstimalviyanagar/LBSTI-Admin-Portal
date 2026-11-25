import React from 'react';
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
  return (
    <>
      <EnquiryDashboard
        enquiries={enquiries}
        loading={loading}
        dashRangeKind={dashRangeKind}
        dashFrom={dashFrom}
        dashTo={dashTo}
        showTrendRangeFilters
        onOpenEdit={onOpenEdit}
        onConfirmAdmission={onConfirmAdmission}
        onDrillIntoTable={onDrillIntoTable}
        onGoToNewLead={onGoToNewLead}
      />
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
