
import React from 'react';
import StudentsSection from '../components/StudentsSection';

export default function StudentsPage({
  students,
  enrollments,
  loading,
  onRefresh
}) {
  return (
    <StudentsSection
      students={students}
      enrollments={enrollments}
      loading={loading}
      onRefresh={onRefresh}
    />
  );
}

