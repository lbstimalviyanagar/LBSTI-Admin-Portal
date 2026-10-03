import React from 'react';
import EnquiriesTable from '../components/EnquiriesTable';

export default function EnquiriesPage({
  enquiries,
  loading,
  counselorList,
  filterParams,
  setFilterParams,
  onOpenEdit,
  onConfirmAdmission,
  onRefresh,
  onGoToNewLead
}) {
  return (
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
  );
}
