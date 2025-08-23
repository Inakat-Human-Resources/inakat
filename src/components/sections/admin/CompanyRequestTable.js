import React from "react";

const CompanyRequestTable = ({ data, onEdit, onApprove, onReject }) => {
  return (
    <div className="overflow-x-auto">
      <h2 className="text-2xl font-bold mb-4">Solicitudes de alta</h2>
      <table className="min-w-full bg-white rounded-lg shadow">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-3 text-left">Nombre</th>
            <th className="p-3 text-left">Apellido Paterno</th>
            <th className="p-3 text-left">Apellido Materno</th>
            <th className="p-3 text-left">Empresa</th>
            <th className="p-3 text-left">Nombre Comercial</th>
            <th className="p-3 text-left">Ubicación</th>
            <th className="p-3 text-center">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {data.map((req) => (
            <tr key={req.id} className="border-t">
              <td className="p-3">{req.nombre}</td>
              <td className="p-3">{req.apellidoPaterno}</td>
              <td className="p-3">{req.apellidoMaterno}</td>
              <td className="p-3">{req.empresa}</td>
              <td className="p-3">{req.nombreComercial}</td>
              <td className="p-3">{req.ubicacion}</td>
              <td className="p-3 flex justify-center gap-2">
                <button
                  onClick={() => onEdit(req.id)}
                  className="bg-gray-300 hover:bg-gray-400 text-black font-semibold px-4 py-1 rounded"
                >
                  Editar
                </button>
                <button
                  onClick={() => onReject(req.id)}
                  className="bg-red-500 hover:bg-red-600 text-white font-semibold px-4 py-1 rounded"
                >
                  Rechazar
                </button>
                <button
                  onClick={() => onApprove(req.id)}
                  className="bg-green-500 hover:bg-green-600 text-white font-semibold px-4 py-1 rounded"
                >
                  Aprobar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default CompanyRequestTable;