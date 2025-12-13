import { Suspense } from 'react';
import CreateJobForm from '@/components/sections/jobs/CreateJobForm';

function CreateJobFormFallback() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/2 mb-8"></div>
          <div className="space-y-4">
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CreateJobPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <Suspense fallback={<CreateJobFormFallback />}>
        <CreateJobForm />
      </Suspense>
    </div>
  );
}
