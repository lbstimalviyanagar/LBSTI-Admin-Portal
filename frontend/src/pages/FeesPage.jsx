import React from 'react';
import FeesSection from '../components/FeesSection';

export default function FeesPage({
  fees,
  enquiries,
  loading,
  onSavePayment,
  onDeletePayment,
  onToast
}) {
  return (
    <FeesSection
      fees={fees}
      enquiries={enquiries}
      loading={loading}
      onSavePayment={onSavePayment}
      onDeletePayment={onDeletePayment}
      onToast={onToast}
    />
  );
}
