// Carga los tipos de los matchers de @testing-library/jest-dom (toBeInTheDocument,
// toBeDisabled, toHaveAttribute, …) en el type-check global de tsc. En runtime se
// importan vía jest.setup.js; este archivo es sólo para que `tsc --noEmit` los vea.
import '@testing-library/jest-dom';
