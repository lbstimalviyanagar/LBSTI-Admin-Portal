import React from 'react';
import PaymentsSection from '../components/PaymentsSection';

export default function PaymentsPage({
  fees,
  enquiries,
  students,
  enrollments,
  loading,
  onSavePayment,
  onUpdatePayment,
  onDeletePayment,
  onToast
}) {
  return (
    <PaymentsSection
      fees={fees}
      enquiries={enquiries}
      students={students}
      enrollments={enrollments}
      loading={loading}
      onSavePayment={onSavePayment}
      onUpdatePayment={onUpdatePayment}
      onDeletePayment={onDeletePayment}
      onToast={onToast}
    />
  );
}
