import React from 'react';
import PaymentsSection from '../components/PaymentsSection';

export default function PaymentsPage({
  fees,
  enquiries,
  loading,
  onSavePayment,
  onDeletePayment,
  onToast
}) {
  return (
    <PaymentsSection
      fees={fees}
      enquiries={enquiries}
      loading={loading}
      onSavePayment={onSavePayment}
      onDeletePayment={onDeletePayment}
      onToast={onToast}
    />
  );
}
