import React from 'react';
import PaymentsSection from '../components/PaymentsSection';

export default function PaymentsPage({
  fees,
  enquiries,
  students,
  enrollments,
  loading,
  onSavePayment,
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
      onDeletePayment={onDeletePayment}
      onToast={onToast}
    />
  );
}
