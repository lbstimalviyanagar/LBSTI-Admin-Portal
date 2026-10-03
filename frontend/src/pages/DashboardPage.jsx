import React from 'react';
import EnquiryDashboard from '../components/EnquiryDashboard';

export default function DashboardPage({
  enquiries,
  loading,
  dashRangeKind,
  dashFrom,
  dashTo,
  onOpenEdit,
  onConfirmAdmission,
  onDrillIntoTable,
  onGoToNewLead
}) {
  return (
    <EnquiryDashboard
      enquiries={enquiries}
      loading={loading}
      dashRangeKind={dashRangeKind}
      dashFrom={dashFrom}
      dashTo={dashTo}
      onOpenEdit={onOpenEdit}
      onConfirmAdmission={onConfirmAdmission}
      onDrillIntoTable={onDrillIntoTable}
      onGoToNewLead={onGoToNewLead}
    />
  );
}
