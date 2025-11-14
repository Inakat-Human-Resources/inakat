import React from "react";
import companyRequests from "./companyRequestsMock";
import CompanyRequestTable from "../../components/sections/admin/CompanyRequestTable";

const AdminCompanyRequests = () => {
  const handleEdit = (id) => {
    console.log("Editar solicitud:", id);
  };

  const handleApprove = (id) => {
    console.log("Aprobar solicitud:", id);
  };

  const handleReject = (id) => {
    console.log("Rechazar solicitud:", id);
  };

  return (
    <div className="container mx-auto py-10 px-4">
      <CompanyRequestTable
        data={companyRequests}
        onEdit={handleEdit}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </div>
  );
};

export default AdminCompanyRequests;