import React, { useEffect, useRef } from 'react';
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
  const pendingTableScroll = useRef(false);

  useEffect(() => {
    if (!pendingTableScroll.current) return;
    pendingTableScroll.current = false;
    document.getElementById('enquiries-table')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }, [filterParams]);

  const handleDrillIntoTable = (patch) => {
    pendingTableScroll.current = true;
    onDrillIntoTable(patch);
  };

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
        onDrillIntoTable={handleDrillIntoTable}
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
