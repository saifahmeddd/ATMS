"use client";

import CourseForm from "@/components/admin/CourseForm";

export default function EditCoursePage({ params }: { params: { id: string } }) {
  const { id } = params;
  return <CourseForm courseId={id} />;
}
