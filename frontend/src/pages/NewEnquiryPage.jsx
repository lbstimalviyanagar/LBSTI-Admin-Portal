import React from 'react';
import NewEnquiryForm from '../components/NewEnquiryForm';

export default function NewEnquiryPage({
  counselorList,
  onSubmit,
  onCancel
}) {
  return (
    <NewEnquiryForm
      counselorList={counselorList}
      onSubmit={onSubmit}
      onCancel={onCancel}
    />
  );
}
